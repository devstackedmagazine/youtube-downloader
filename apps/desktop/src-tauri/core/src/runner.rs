//! Runs yt-dlp/ffmpeg/ffprobe as child processes: streaming output, cancellation (kills
//! the whole process tree) and cleanup of partial files.
use crate::{args, clip, errors, filename, progress, progress::Progress, Format, Metadata, Request, Tools};
use serde_json::Value;
use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use std::{fs, thread};

#[derive(Debug, PartialEq)]
pub enum Error {
    Cancelled,
    Failed(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Cancelled => f.write_str(errors::CANCELLED),
            Error::Failed(message) => f.write_str(message),
        }
    }
}

/// A command with no console window on Windows and UTF-8 output from yt-dlp's Python.
pub fn command(program: &Path) -> Command {
    let mut cmd = Command::new(program);
    cmd.env("PYTHONUTF8", "1").env("PYTHONIOENCODING", "utf-8").stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        // Own process group, so cancelling also stops the ffmpeg children yt-dlp starts.
        cmd.process_group(0);
    }
    cmd
}

/// Kill `child` and everything it started.
fn kill_tree(child: &mut Child) {
    #[cfg(unix)]
    unsafe {
        let group = -(child.id() as i32);
        libc::kill(group, libc::SIGTERM);
        for _ in 0..20 {
            if matches!(child.try_wait(), Ok(Some(_))) {
                break;
            }
            thread::sleep(Duration::from_millis(100));
        }
        libc::kill(group, libc::SIGKILL);
    }
    #[cfg(windows)]
    {
        // yt-dlp.exe is a PyInstaller bootstrapper with its own child, plus ffmpeg: /T kills the tree.
        let _ = command(Path::new("taskkill"))
            .args(["/PID", &child.id().to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    let _ = child.kill();
    let _ = child.wait();
}

pub struct Output {
    pub status: ExitStatus,
    pub stdout: String,
    /// The last ~60 stderr lines, for error messages.
    pub stderr: String,
}

/// Run `cmd`, calling `on_line` for every stdout line. Stops (and kills the tree) when `cancel`
/// is set or `timeout` passes. stdout is only collected when `keep_stdout` (e.g. `-J`).
pub fn run(
    mut cmd: Command,
    cancel: &AtomicBool,
    timeout: Option<Duration>,
    keep_stdout: bool,
    mut on_line: impl FnMut(&str),
) -> Result<Output, Error> {
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| Error::Failed(format!("Couldn't start a bundled tool: {e}. Try reinstalling dltube.")))?;

    let stderr_tail = Arc::new(Mutex::new(VecDeque::new()));
    let stderr = child.stderr.take().expect("piped");
    let tail = Arc::clone(&stderr_tail);
    let stderr_thread = thread::spawn(move || {
        for line in BufReader::new(stderr).split(b'\n').map_while(Result::ok) {
            let mut tail = tail.lock().unwrap();
            if tail.len() == 60 {
                tail.pop_front();
            }
            tail.push_back(String::from_utf8_lossy(&line).trim_end().to_string());
        }
    });

    let (tx, rx) = mpsc::channel::<Vec<u8>>();
    let mut stdout = child.stdout.take().expect("piped");
    let stdout_thread = thread::spawn(move || {
        if keep_stdout {
            let mut all = Vec::new();
            let _ = stdout.read_to_end(&mut all);
            let _ = tx.send(all);
        } else {
            for line in BufReader::new(stdout).split(b'\n').map_while(Result::ok) {
                if tx.send(line).is_err() {
                    break;
                }
            }
        }
    });

    let started = Instant::now();
    let mut collected = String::new();
    loop {
        if cancel.load(Ordering::SeqCst) {
            kill_tree(&mut child);
            return Err(Error::Cancelled);
        }
        if timeout.is_some_and(|t| started.elapsed() > t) {
            kill_tree(&mut child);
            return Err(Error::Failed("YouTube took too long to answer. Try again.".into()));
        }
        match rx.recv_timeout(Duration::from_millis(150)) {
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes);
                if keep_stdout {
                    collected.push_str(&text);
                } else {
                    on_line(text.trim_end());
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
    let status = child.wait().map_err(|e| Error::Failed(e.to_string()))?;
    let _ = stdout_thread.join();
    let _ = stderr_thread.join();
    let stderr = stderr_tail.lock().unwrap().iter().cloned().collect::<Vec<_>>().join("\n");
    Ok(Output { status, stdout: collected, stderr })
}

/// Video or flat-playlist details for the UI (same shape as GET /api/metadata).
pub fn fetch_metadata(tools: &Tools, url: &str, single: bool, cancel: &AtomicBool) -> Result<Metadata, Error> {
    let mut cmd = command(&tools.ytdlp);
    cmd.args(args::metadata(tools, url, single).map_err(Error::Failed)?);
    let out = run(cmd, cancel, Some(Duration::from_secs(90)), true, |_| {})?;
    if !out.status.success() {
        return Err(Error::Failed(errors::friendly(&out.stderr)));
    }
    let info: Value = serde_json::from_str(&out.stdout)
        .map_err(|_| Error::Failed("YouTube sent an unexpected answer. Try updating yt-dlp in Settings.".into()))?;
    Ok(parse_metadata(&info))
}

pub fn parse_metadata(info: &Value) -> Metadata {
    let s = |v: &Value, key: &str| v.get(key).and_then(Value::as_str).map(str::to_string);
    let entries = info.get("entries").and_then(Value::as_array);
    let is_playlist =
        info.get("_type").and_then(Value::as_str) == Some("playlist") || entries.is_some_and(|e| !e.is_empty());
    let live = info.get("is_live").and_then(Value::as_bool).unwrap_or(false)
        || matches!(info.get("live_status").and_then(Value::as_str), Some("is_live" | "is_upcoming"));
    // Flat playlists have no top-level thumbnail; use the largest listed, or the first entry's.
    let last_thumb =
        |v: &Value| v.get("thumbnails").and_then(Value::as_array).and_then(|t| t.last()).and_then(|t| s(t, "url"));
    let thumbnail = s(info, "thumbnail")
        .or_else(|| last_thumb(info))
        .or_else(|| entries.and_then(|e| e.first()).and_then(last_thumb))
        .unwrap_or_default();
    let title = s(info, "title").unwrap_or_else(|| "Unknown Title".into());
    Metadata {
        id: s(info, "id").unwrap_or_default(),
        duration: info.get("duration").and_then(Value::as_f64).unwrap_or(0.0),
        thumbnail,
        channel: s(info, "uploader").or_else(|| s(info, "channel")).unwrap_or_else(|| "Unknown Channel".into()),
        is_live: live,
        is_playlist,
        playlist_count: if is_playlist {
            info.get("playlist_count").and_then(Value::as_u64).unwrap_or(entries.map_or(0, |e| e.len() as u64))
        } else {
            0
        },
        playlist_title: is_playlist.then(|| title.clone()),
        title,
    }
}

/// Re-encode the audio to AAC if an MP4 has another codec (e.g. Opus), so every player handles it.
/// Port of ensure_aac_in_mp4; failures are not fatal, the file still plays in most players.
fn ensure_aac(tools: &Tools, path: &Path, cancel: &AtomicBool) -> Result<(), Error> {
    let mut probe = command(&tools.ffprobe);
    probe.args(["-v", "quiet", "-print_format", "json", "-show_streams"]).arg(path);
    let Ok(out) = run(probe, cancel, Some(Duration::from_secs(60)), true, |_| {}) else {
        return if cancel.load(Ordering::SeqCst) { Err(Error::Cancelled) } else { Ok(()) };
    };
    let streams: Value = serde_json::from_str(&out.stdout).unwrap_or_default();
    let codec = streams["streams"]
        .as_array()
        .and_then(|s| s.iter().find(|s| s["codec_type"] == "audio"))
        .and_then(|s| s["codec_name"].as_str())
        .map(str::to_ascii_lowercase);
    if codec.is_none() || codec.as_deref() == Some("aac") {
        return Ok(());
    }
    let fixed = path.with_file_name("media_aac.mp4");
    let mut ffmpeg = command(&tools.ffmpeg);
    ffmpeg.args(["-y", "-v", "error", "-i"]).arg(path);
    ffmpeg.args(["-map", "0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k"]).arg(&fixed);
    match run(ffmpeg, cancel, None, false, |_| {}) {
        Ok(out) if out.status.success() => fs::rename(&fixed, path).map_err(|e| Error::Failed(errors::from_io(&e))),
        Err(Error::Cancelled) => Err(Error::Cancelled),
        _ => {
            let _ = fs::remove_file(&fixed);
            Ok(())
        }
    }
}

/// A fresh private folder inside `out_dir` for partial files (same disk, so moving is a rename).
fn work_dir(out_dir: &Path) -> Result<PathBuf, Error> {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_nanos());
    let dir = out_dir.join(format!(".dltube-partial-{}-{nanos}", std::process::id()));
    fs::create_dir_all(&dir).map_err(|e| Error::Failed(errors::from_io(&e)))?;
    Ok(dir)
}

/// Download `req` into `out_dir`. Returns the final file paths (one, or one per playlist item).
/// Partial files are always removed, whether it fails, is cancelled or succeeds.
pub fn download(
    tools: &Tools,
    req: &Request,
    out_dir: &Path,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(&Progress),
) -> Result<Vec<PathBuf>, Error> {
    clip::validate(req.start, req.end, req.duration, req.playlist, false).map_err(Error::Failed)?;
    let work = work_dir(out_dir)?;
    let result = download_into(tools, req, out_dir, &work, cancel, &mut on_progress);
    let _ = fs::remove_dir_all(&work);
    result
}

fn download_into(
    tools: &Tools,
    req: &Request,
    out_dir: &Path,
    work: &Path,
    cancel: &AtomicBool,
    on_progress: &mut impl FnMut(&Progress),
) -> Result<Vec<PathBuf>, Error> {
    let mut cmd = command(&tools.ytdlp);
    cmd.args(args::download(tools, req, work).map_err(Error::Failed)?);
    let mut files = Vec::new();
    let out = run(cmd, cancel, None, false, |line| {
        if let Some(p) = progress::parse_line(line) {
            on_progress(&p);
        } else if let Some(path) = line.strip_prefix(progress::FILE_PREFIX) {
            files.push(PathBuf::from(path));
        }
    })?;
    // Only trust files inside our own work folder.
    files.retain(|f| f.starts_with(work) && f.is_file());
    // Playlists skip broken items (exit code 1) but still succeed if anything was downloaded.
    if files.is_empty() || (!req.playlist && !out.status.success()) {
        return Err(Error::Failed(errors::friendly(&out.stderr)));
    }
    let io = |e: std::io::Error| Error::Failed(errors::from_io(&e));

    if !req.playlist {
        let file = &files[0];
        if req.format == Format::Mp4 {
            on_progress(&Progress { status: "processing".into(), ..Progress::default() });
            ensure_aac(tools, file, cancel)?;
        }
        let ext = if req.format == Format::Mp4 { "mp4" } else { "mp3" };
        let name = filename::output_filename(&req.title, ext, req.start, req.end, req.duration);
        let dest = filename::unique_path(out_dir, &name);
        fs::rename(file, &dest).map_err(io)?;
        return Ok(vec![dest]);
    }

    let folder = filename::unique_path(out_dir, &filename::sanitize(&req.title));
    fs::create_dir_all(&folder).map_err(io)?;
    let mut moved = Vec::new();
    for file in files {
        let name = file.file_name().and_then(|n| n.to_str()).unwrap_or("item").to_string();
        let dest = filename::unique_path(&folder, &name);
        fs::rename(&file, &dest).map_err(io)?;
        moved.push(dest);
    }
    Ok(moved)
}

/// `yt-dlp --version` (None if the binary is missing or broken).
pub fn tool_version(program: &Path, arg: &str) -> Option<String> {
    let mut cmd = command(program);
    cmd.arg(arg);
    let out = run(cmd, &AtomicBool::new(false), Some(Duration::from_secs(60)), true, |_| {}).ok()?;
    let first = out.stdout.lines().next()?.trim().to_string();
    (out.status.success() && !first.is_empty()).then_some(first)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_video_metadata() {
        let m = parse_metadata(&json!({
            "id": "jNQXAC9IVRw", "title": "Me at the zoo", "duration": 19, "uploader": "jawed",
            "thumbnail": "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg", "live_status": "not_live"
        }));
        assert_eq!(m.title, "Me at the zoo");
        assert_eq!(m.duration, 19.0);
        assert_eq!(m.channel, "jawed");
        assert!(!m.is_playlist && !m.is_live);
        assert_eq!(m.playlist_title, None);
    }

    #[test]
    fn parses_flat_playlist_metadata() {
        let m = parse_metadata(&json!({
            "_type": "playlist", "id": "PL1", "title": "Mix", "channel": "c", "playlist_count": 12,
            "entries": [{"thumbnails": [{"url": "https://i.ytimg.com/a.jpg"}, {"url": "https://i.ytimg.com/b.jpg"}]}]
        }));
        assert!(m.is_playlist);
        assert_eq!(m.playlist_count, 12);
        assert_eq!(m.playlist_title.as_deref(), Some("Mix"));
        assert_eq!(m.thumbnail, "https://i.ytimg.com/b.jpg");
        assert!(parse_metadata(&json!({"live_status": "is_upcoming"})).is_live);
    }

    #[cfg(unix)]
    #[test]
    fn cancel_kills_the_process_group() {
        // A shell that starts a grandchild, like yt-dlp starting ffmpeg.
        let marker = tempfile::tempdir().unwrap();
        let pid_file = marker.path().join("pid");
        let mut cmd = command(Path::new("/bin/sh"));
        cmd.arg("-c").arg(format!("sleep 30 & echo $! > {}; echo started; wait", pid_file.display()));
        let cancel = AtomicBool::new(false);
        let started = Instant::now();
        let result = run(cmd, &cancel, None, false, |line| {
            if line == "started" {
                cancel.store(true, Ordering::SeqCst);
            }
        });
        assert_eq!(result.err(), Some(Error::Cancelled));
        assert!(started.elapsed() < Duration::from_secs(10));
        let pid: i32 = fs::read_to_string(&pid_file).unwrap().trim().parse().unwrap();
        thread::sleep(Duration::from_millis(200));
        assert_ne!(unsafe { libc::kill(pid, 0) }, 0, "grandchild still running");
    }

    #[cfg(unix)]
    #[test]
    fn timeout_kills() {
        let mut cmd = command(Path::new("/bin/sh"));
        cmd.args(["-c", "sleep 30"]);
        let result = run(cmd, &AtomicBool::new(false), Some(Duration::from_millis(300)), true, |_| {});
        assert!(matches!(result, Err(Error::Failed(m)) if m.contains("too long")));
    }

    #[test]
    fn missing_binary_is_a_friendly_error() {
        let result = run(command(Path::new("/nonexistent/yt-dlp")), &AtomicBool::new(false), None, true, |_| {});
        assert!(matches!(result, Err(Error::Failed(m)) if m.contains("reinstalling")));
    }
}
