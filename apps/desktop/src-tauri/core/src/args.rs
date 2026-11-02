//! yt-dlp command lines. Every option comes from this file; the only free text from the UI is
//! the (validated) URL, and it always goes after `--` so it can't be read as an option.
//! Mirrors download_options/format_selector/clip_options in apps/api/app/tasks/convert_video.py.
use crate::{clip, progress, url, Format, Request, Tools};
use std::path::Path;

/// Sane guard instead of the server's MAX_PLAYLIST_ITEMS.
pub const MAX_PLAYLIST_ITEMS: u32 = 1000;

/// Options every invocation gets: our own tools only, no user config or plugins.
fn common(tools: &Tools) -> Vec<String> {
    let mut args: Vec<String> =
        ["--ignore-config", "--no-plugin-dirs", "--use-extractors", "youtube", "--no-js-runtimes", "--js-runtimes"]
            .map(String::from)
            .into();
    args.push(format!("deno:{}", tools.deno.display()));
    args.push("--ffmpeg-location".into());
    args.push(tools.ffmpeg.display().to_string());
    args.push("--cache-dir".into());
    args.push(tools.cache_dir.display().to_string());
    args.extend(["--socket-timeout", "30", "--color", "never"].map(String::from));
    args
}

fn checked_url(raw: &str) -> Result<String, String> {
    if url::is_youtube_url(raw) {
        Ok(url::normalize(raw))
    } else {
        Err("That doesn't look like a YouTube link. Paste a youtube.com or youtu.be URL.".into())
    }
}

/// `yt-dlp -J` for the metadata card. `single` ignores the playlist part of watch?v=..&list=.. URLs.
pub fn metadata(tools: &Tools, raw_url: &str, single: bool) -> Result<Vec<String>, String> {
    let url = checked_url(raw_url)?;
    let mut args = common(tools);
    args.extend(["-J", "--flat-playlist", "--playlist-end"].map(String::from));
    args.push(MAX_PLAYLIST_ITEMS.to_string());
    // Title/duration/live status don't need deciphered formats: skip the player JS (much faster).
    args.extend(["--extractor-args", "youtube:player_skip=js"].map(String::from));
    args.push(if single { "--no-playlist" } else { "--yes-playlist" }.into());
    args.extend(["--".into(), url]);
    Ok(args)
}

fn mp4_height(quality: &str) -> Result<u32, String> {
    match quality {
        "1440p" => Ok(1440),
        "1080p" => Ok(1080),
        "720p" => Ok(720),
        "480p" => Ok(480),
        "360p" => Ok(360),
        _ => Err(format!("Unsupported MP4 quality: {quality}")),
    }
}

fn mp3_bitrate(quality: &str) -> Result<&'static str, String> {
    match quality {
        "320kbps" => Ok("320K"),
        "256kbps" => Ok("256K"),
        "128kbps" => Ok("128K"),
        _ => Err(format!("Unsupported MP3 quality: {quality}")),
    }
}

/// Format selection. Whole MP4s get the best stream like the web app (audio fixed to AAC
/// afterwards). Sections prefer H.264 + AAC, since cutting re-encodes with libx264 anyway.
pub fn format_selector(format: Format, quality: &str, is_clip: bool) -> Result<String, String> {
    Ok(match format {
        Format::Mp3 => "bestaudio/best".into(),
        Format::Mp4 => {
            let h = mp4_height(quality)?;
            if is_clip {
                format!("bv*[height<={h}][vcodec^=avc1]+ba[acodec^=mp4a]/bv*[height<={h}]+ba/b[height<={h}]/b")
            } else {
                format!("bv*[height<={h}]+ba/b[height<={h}]/b")
            }
        }
    })
}

/// Full download command; output goes to `work_dir` (a private temp folder).
pub fn download(tools: &Tools, req: &Request, work_dir: &Path) -> Result<Vec<String>, String> {
    let url = checked_url(&req.url)?;
    let is_clip = req.start.is_some() || req.end.is_some();
    if is_clip && req.playlist {
        return Err("Sections can only be downloaded from a single video, not a playlist.".into());
    }
    let mut args = common(tools);
    args.extend(
        ["--newline", "--progress", "--progress-delta", "0.5", "--progress-template", progress::TEMPLATE]
            .map(String::from),
    );
    args.extend(["--print".into(), format!("after_move:{}%(filepath)s", progress::FILE_PREFIX)]);
    args.extend(["-P".into(), work_dir.display().to_string(), "-o".into()]);
    args.push(if req.playlist { "%(playlist_index)03d - %(title).180B.%(ext)s" } else { "media.%(ext)s" }.into());
    args.push("--windows-filenames".into());
    if req.playlist {
        // Skip unavailable items instead of failing the whole playlist.
        args.extend(["--yes-playlist", "--ignore-errors", "--playlist-end"].map(String::from));
        args.push(MAX_PLAYLIST_ITEMS.to_string());
    } else {
        // --no-playlist doesn't stop a pure playlist URL; cap single jobs at one item.
        args.extend(["--no-playlist", "--abort-on-error", "--playlist-end", "1"].map(String::from));
    }
    args.extend(["-f".into(), format_selector(req.format, &req.quality, is_clip)?]);
    match req.format {
        Format::Mp3 => args
            .extend(["-x", "--audio-format", "mp3", "--audio-quality", mp3_bitrate(&req.quality)?].map(String::from)),
        Format::Mp4 => args.extend(["--merge-output-format", "mp4"].map(String::from)),
    }
    if is_clip {
        args.extend(["--download-sections".into(), clip::section_arg(req.start, req.end)]);
        // Re-encode around the cuts so the clip starts/ends exactly, not on the nearest keyframe.
        args.extend(["--force-keyframes-at-cuts", "--downloader-args", "ffmpeg_o:-preset veryfast"].map(String::from));
    }
    args.extend(["--".into(), url]);
    Ok(args)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn tools() -> Tools {
        Tools {
            ytdlp: PathBuf::from("/app/yt-dlp"),
            ffmpeg: PathBuf::from("/app/ffmpeg"),
            ffprobe: PathBuf::from("/app/ffprobe"),
            deno: PathBuf::from("/app/deno"),
            cache_dir: PathBuf::from("/data/cache"),
        }
    }

    fn req(format: Format, quality: &str) -> Request {
        Request {
            url: "https://www.youtube.com/watch?v=jNQXAC9IVRw".into(),
            format,
            quality: quality.into(),
            playlist: false,
            start: None,
            end: None,
            title: "Me at the zoo".into(),
            duration: 19.0,
        }
    }

    fn value_after<'a>(args: &'a [String], flag: &str) -> Option<&'a str> {
        args.iter().position(|a| a == flag).map(|i| args[i + 1].as_str())
    }

    #[test]
    fn url_is_last_and_after_double_dash() {
        let args = download(&tools(), &req(Format::Mp4, "720p"), Path::new("/tmp/w")).unwrap();
        let n = args.len();
        assert_eq!(args[n - 2], "--");
        assert_eq!(args[n - 1], "https://www.youtube.com/watch?v=jNQXAC9IVRw");
        assert_eq!(args.iter().filter(|a| *a == "--").count(), 1);
        let meta = metadata(&tools(), "youtu.be/jNQXAC9IVRw", true).unwrap();
        assert_eq!(&meta[meta.len() - 2..], ["--", "https://youtu.be/jNQXAC9IVRw"]);
    }

    #[test]
    fn rejects_non_youtube_and_option_like_urls() {
        for bad in ["--exec=calc", "-o", "https://example.com/v", "file:///etc/passwd"] {
            let mut r = req(Format::Mp4, "720p");
            r.url = bad.into();
            assert!(download(&tools(), &r, Path::new("/w")).is_err(), "{bad}");
            assert!(metadata(&tools(), bad, false).is_err(), "{bad}");
        }
    }

    #[test]
    fn qualities_are_allow_listed() {
        assert!(download(&tools(), &req(Format::Mp4, "4320p"), Path::new("/w")).is_err());
        assert!(download(&tools(), &req(Format::Mp4, "720p --exec x"), Path::new("/w")).is_err());
        assert!(download(&tools(), &req(Format::Mp3, "720p"), Path::new("/w")).is_err());
        assert!(download(&tools(), &req(Format::Mp4, "320kbps"), Path::new("/w")).is_err());
    }

    #[test]
    fn uses_bundled_tools_and_ignores_user_config() {
        let args = metadata(&tools(), "https://youtu.be/x", false).unwrap();
        for flag in ["--ignore-config", "--no-plugin-dirs", "--no-js-runtimes", "--yes-playlist", "--flat-playlist"] {
            assert!(args.iter().any(|a| a == flag), "{flag}");
        }
        assert_eq!(value_after(&args, "--js-runtimes"), Some("deno:/app/deno"));
        assert_eq!(value_after(&args, "--ffmpeg-location"), Some("/app/ffmpeg"));
        assert_eq!(value_after(&args, "--use-extractors"), Some("youtube"));
        assert!(metadata(&tools(), "https://youtu.be/x", true).unwrap().iter().any(|a| a == "--no-playlist"));
    }

    #[test]
    fn whole_mp4() {
        let args = download(&tools(), &req(Format::Mp4, "1080p"), Path::new("/tmp/w")).unwrap();
        assert_eq!(value_after(&args, "-f"), Some("bv*[height<=1080]+ba/b[height<=1080]/b"));
        assert_eq!(value_after(&args, "--merge-output-format"), Some("mp4"));
        assert_eq!(value_after(&args, "-o"), Some("media.%(ext)s"));
        assert_eq!(value_after(&args, "-P"), Some("/tmp/w"));
        assert_eq!(value_after(&args, "--playlist-end"), Some("1"));
        assert!(!args.iter().any(|a| a == "--download-sections"));
    }

    #[test]
    fn mp3_section() {
        let mut r = req(Format::Mp3, "320kbps");
        r.start = Some(5.0);
        r.end = Some(12.0);
        let args = download(&tools(), &r, Path::new("/tmp/w")).unwrap();
        assert_eq!(value_after(&args, "-f"), Some("bestaudio/best"));
        assert_eq!(value_after(&args, "--audio-format"), Some("mp3"));
        assert_eq!(value_after(&args, "--audio-quality"), Some("320K"));
        assert_eq!(value_after(&args, "--download-sections"), Some("*5-12"));
        assert!(args.iter().any(|a| a == "--force-keyframes-at-cuts"));
    }

    #[test]
    fn mp4_section_prefers_h264() {
        let mut r = req(Format::Mp4, "720p");
        r.start = Some(300.0);
        let args = download(&tools(), &r, Path::new("/w")).unwrap();
        assert!(value_after(&args, "-f").unwrap().starts_with("bv*[height<=720][vcodec^=avc1]+ba[acodec^=mp4a]/"));
        assert_eq!(value_after(&args, "--download-sections"), Some("*300-inf"));
    }

    #[test]
    fn playlist() {
        let mut r = req(Format::Mp3, "128kbps");
        r.playlist = true;
        let args = download(&tools(), &r, Path::new("/w")).unwrap();
        assert!(args.iter().any(|a| a == "--yes-playlist"));
        assert!(args.iter().any(|a| a == "--ignore-errors"));
        assert_eq!(value_after(&args, "-o"), Some("%(playlist_index)03d - %(title).180B.%(ext)s"));
        r.start = Some(1.0);
        assert!(download(&tools(), &r, Path::new("/w")).is_err());
    }
}
