//! Tauri glue: one-at-a-time job queue, history, settings and update checks around dltube-core.
//! The web view only gets these commands; Rust spawns the bundled tools itself.
use dltube_core::progress::Progress;
use dltube_core::{args, clip, runner, update, Format, Metadata, Request, Tools};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex, RwLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

/// GitHub repo whose releases are checked for app updates.
const REPO: &str = "devstackedmagazine/youtube-downloader";
const NOTICES: &str = include_str!("../../THIRD_PARTY_NOTICES.md");
const LICENSE: &str = include_str!("../../../../LICENSE");
const SIDECARS: &str = include_str!("../../sidecars.json");
const MAX_HISTORY: usize = 500;

#[derive(Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Status {
    Queued,
    Running,
    Done,
    Failed,
    Cancelled,
}

#[derive(Clone, Serialize)]
struct Job {
    id: u64,
    request: Request,
    status: Status,
    progress: Option<Progress>,
    error: Option<String>,
    output: Option<PathBuf>,
    #[serde(skip)]
    cancel: Arc<AtomicBool>,
}

#[derive(Clone, Serialize, Deserialize)]
struct HistoryEntry {
    id: u64,
    title: String,
    format: Format,
    quality: String,
    start: Option<f64>,
    end: Option<f64>,
    playlist: bool,
    items: usize,
    /// The file, or the folder for playlists.
    path: PathBuf,
    /// Unix seconds.
    date: u64,
}

#[derive(Default, Serialize, Deserialize)]
struct Settings {
    output_dir: Option<PathBuf>,
}

struct App {
    data_dir: PathBuf,
    default_output: PathBuf,
    tools: Tools,
    managed: update::Managed,
    jobs: Mutex<Vec<Job>>,
    wake: Condvar,
    next_id: AtomicU64,
    history: Mutex<Vec<HistoryEntry>>,
    settings: Mutex<Settings>,
    /// Jobs and lookups hold it for reading; swapping in a new yt-dlp needs it for writing.
    tool_lock: RwLock<()>,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs())
}

fn load<T: DeserializeOwned + Default>(path: &Path) -> T {
    fs::read(path).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_default()
}

/// Write via a temp file + rename so a crash never leaves half a JSON file.
fn save<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

impl App {
    fn output_dir(&self) -> PathBuf {
        self.settings.lock().unwrap().output_dir.clone().unwrap_or_else(|| self.default_output.clone())
    }
    fn history_path(&self) -> PathBuf {
        self.data_dir.join("history.json")
    }
    fn emit_jobs(&self, app: &AppHandle) {
        let _ = app.emit("jobs", self.jobs.lock().unwrap().clone());
    }
    fn set_job(&self, app: &AppHandle, id: u64, change: impl FnOnce(&mut Job)) {
        if let Some(job) = self.jobs.lock().unwrap().iter_mut().find(|j| j.id == id) {
            change(job);
        }
        self.emit_jobs(app);
    }
}

fn worker(app: AppHandle) {
    let st = app.state::<App>();
    loop {
        let job = {
            let mut jobs = st.jobs.lock().unwrap();
            loop {
                if let Some(job) = jobs.iter_mut().find(|j| j.status == Status::Queued) {
                    job.status = Status::Running;
                    break job.clone();
                }
                jobs = st.wake.wait(jobs).unwrap();
            }
        };
        st.emit_jobs(&app);

        let out_dir = st.output_dir();
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        let result = {
            let _tools = st.tool_lock.read().unwrap();
            fs::create_dir_all(&out_dir).map_err(|e| runner::Error::Failed(dltube_core::errors::from_io(&e))).and_then(
                |_| {
                    runner::download(&st.tools, &job.request, &out_dir, &job.cancel, |p| {
                        if let Some(j) = st.jobs.lock().unwrap().iter_mut().find(|j| j.id == job.id) {
                            j.progress = Some(p.clone());
                        }
                        if last_emit.elapsed() >= Duration::from_millis(250) || p.status != "downloading" {
                            last_emit = Instant::now();
                            st.emit_jobs(&app);
                        }
                    })
                },
            )
        };

        match result {
            Ok(files) => {
                let req = &job.request;
                let path = if req.playlist {
                    files.first().and_then(|f| f.parent()).map(Path::to_path_buf).unwrap_or(out_dir)
                } else {
                    files[0].clone()
                };
                let entry = HistoryEntry {
                    id: job.id,
                    title: req.title.clone(),
                    format: req.format,
                    quality: req.quality.clone(),
                    start: req.start,
                    end: req.end,
                    playlist: req.playlist,
                    items: files.len(),
                    path: path.clone(),
                    date: now(),
                };
                {
                    let mut history = st.history.lock().unwrap();
                    history.insert(0, entry);
                    history.truncate(MAX_HISTORY);
                    let _ = save(&st.history_path(), &*history);
                }
                st.set_job(&app, job.id, |j| {
                    j.status = Status::Done;
                    j.output = Some(path);
                });
                let _ = app.emit("history-changed", ());
            }
            Err(runner::Error::Cancelled) => st.set_job(&app, job.id, |j| j.status = Status::Cancelled),
            Err(runner::Error::Failed(message)) => st.set_job(&app, job.id, |j| {
                j.status = Status::Failed;
                j.error = Some(message);
            }),
        }
    }
}

/// Daily yt-dlp update check (if enabled). Runs in the background at startup.
fn auto_update_ytdlp(app: &AppHandle) {
    let st = app.state::<App>();
    let mut state = st.managed.state();
    if !update::should_check(&state, now()) {
        return;
    }
    state.last_check = now();
    let _ = st.managed.save_state(&state);
    if let Ok(release) = update::latest_ytdlp() {
        // Waits for a running download to finish before swapping the binary.
        let _lock = st.tool_lock.write().unwrap();
        let _ = st.managed.update_to(&release);
    }
}

#[tauri::command]
async fn get_metadata(app: AppHandle, url: String, single: bool) -> Result<Metadata, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let st = app.state::<App>();
        let _tools = st.tool_lock.read().unwrap();
        runner::fetch_metadata(&st.tools, &url, single, &AtomicBool::new(false)).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn enqueue(app: AppHandle, st: State<App>, request: Request) -> Result<u64, String> {
    // Same checks the runner does, so bad input fails here instead of in the queue.
    args::download(&st.tools, &request, Path::new("."))?;
    clip::validate(request.start, request.end, request.duration, request.playlist, false)?;
    let id = st.next_id.fetch_add(1, Ordering::SeqCst);
    let job = Job {
        id,
        request,
        status: Status::Queued,
        progress: None,
        error: None,
        output: None,
        cancel: Arc::new(AtomicBool::new(false)),
    };
    st.jobs.lock().unwrap().push(job);
    st.wake.notify_all();
    st.emit_jobs(&app);
    Ok(id)
}

#[tauri::command]
fn cancel(app: AppHandle, st: State<App>, id: u64) {
    st.set_job(&app, id, |j| match j.status {
        Status::Queued => j.status = Status::Cancelled,
        Status::Running => j.cancel.store(true, Ordering::SeqCst),
        _ => {}
    });
}

#[tauri::command]
fn jobs(st: State<App>) -> Vec<Job> {
    st.jobs.lock().unwrap().clone()
}

#[tauri::command]
fn clear_finished(app: AppHandle, st: State<App>) {
    st.jobs.lock().unwrap().retain(|j| matches!(j.status, Status::Queued | Status::Running));
    st.emit_jobs(&app);
}

#[tauri::command]
fn history(st: State<App>) -> Vec<HistoryEntry> {
    st.history.lock().unwrap().clone()
}

#[tauri::command]
fn clear_history(st: State<App>) -> Result<(), String> {
    let mut history = st.history.lock().unwrap();
    history.clear();
    save(&st.history_path(), &*history)
}

/// Open a history entry's file, or show it in the file manager. Only paths from history are accepted.
#[tauri::command]
fn open_entry(app: AppHandle, st: State<App>, id: u64, reveal: bool) -> Result<(), String> {
    let path = st.history.lock().unwrap().iter().find(|e| e.id == id).map(|e| e.path.clone());
    let path = path.ok_or("That download is no longer in the history.")?;
    if !path.exists() {
        return Err("The file was moved or deleted.".into());
    }
    if reveal {
        app.opener().reveal_item_in_dir(&path).map_err(|e| e.to_string())
    } else {
        app.opener().open_path(path.to_string_lossy(), None::<&str>).map_err(|e| e.to_string())
    }
}

#[derive(Serialize)]
struct SettingsView {
    output_dir: PathBuf,
    ytdlp_version: String,
    auto_update: bool,
    last_check: u64,
    app_version: String,
}

#[tauri::command]
fn settings(app: AppHandle, st: State<App>) -> SettingsView {
    let state = st.managed.state();
    SettingsView {
        output_dir: st.output_dir(),
        ytdlp_version: state.version,
        auto_update: state.auto_update,
        last_check: state.last_check,
        app_version: app.package_info().version.to_string(),
    }
}

#[tauri::command]
async fn choose_output_dir(app: AppHandle) -> Result<Option<PathBuf>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let st = app.state::<App>();
        let picked = app.dialog().file().set_directory(st.output_dir()).blocking_pick_folder();
        let Some(dir) = picked.and_then(|p| p.into_path().ok()) else { return Ok(None) };
        let mut settings = st.settings.lock().unwrap();
        settings.output_dir = Some(dir.clone());
        save(&st.data_dir.join("settings.json"), &*settings)?;
        Ok(Some(dir))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn set_auto_update(st: State<App>, enabled: bool) -> Result<(), String> {
    let mut state = st.managed.state();
    state.auto_update = enabled;
    st.managed.save_state(&state).map_err(|e| e.to_string())
}

#[tauri::command]
async fn update_ytdlp(app: AppHandle) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let st = app.state::<App>();
        let release = update::latest_ytdlp()?;
        let Ok(_lock) = st.tool_lock.try_write() else {
            return Err("Wait until the current download finishes, then try again.".to_string());
        };
        let mut state = st.managed.state();
        state.last_check = now();
        let _ = st.managed.save_state(&state);
        Ok(match st.managed.update_to(&release)? {
            Some(version) => format!("Updated yt-dlp to {version}."),
            None => format!("yt-dlp {} is the latest version.", st.managed.state().version),
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn check_app_update(app: AppHandle) -> Result<Option<update::AppRelease>, String> {
    let current = app.package_info().version.to_string();
    tauri::async_runtime::spawn_blocking(move || update::check_app(REPO, &current)).await.map_err(|e| e.to_string())?
}

/// Open a dltube release page (the only URL the UI may open).
#[tauri::command]
fn open_release(app: AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with(&format!("https://github.com/{REPO}/releases")) {
        return Err("Not a dltube release link.".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct About {
    version: String,
    license: &'static str,
    notices: &'static str,
    sidecars: serde_json::Value,
}

#[tauri::command]
fn about(app: AppHandle) -> About {
    About {
        version: app.package_info().version.to_string(),
        license: LICENSE,
        notices: NOTICES,
        sidecars: serde_json::from_str(SIDECARS).unwrap_or_default(),
    }
}

fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&data_dir)?;
    // Bundled as resources (not externalBin) so the .deb doesn't put ffmpeg/yt-dlp into /usr/bin.
    let tools_dir = app.path().resource_dir()?.join("tools");
    let tool = |name: &str| tools_dir.join(update::exe_name(name));
    let managed = update::Managed::new(&data_dir);
    let bundled_version = serde_json::from_str::<serde_json::Value>(SIDECARS)?["yt-dlp"]["version"]
        .as_str()
        .unwrap_or_default()
        .to_string();
    // Fall back to the bundled copy if app data isn't writable.
    let ytdlp = managed.ensure(&tool("yt-dlp"), &bundled_version).unwrap_or_else(|_| tool("yt-dlp"));
    let default_output = app.path().download_dir().or_else(|_| app.path().home_dir())?;
    let state = App {
        tools: Tools {
            ytdlp,
            ffmpeg: tool("ffmpeg"),
            ffprobe: tool("ffprobe"),
            deno: tool("deno"),
            cache_dir: data_dir.join("cache"),
        },
        managed,
        jobs: Mutex::new(Vec::new()),
        wake: Condvar::new(),
        next_id: AtomicU64::new(now() * 1000),
        history: Mutex::new(load(&data_dir.join("history.json"))),
        settings: Mutex::new(load(&data_dir.join("settings.json"))),
        tool_lock: RwLock::new(()),
        default_output,
        data_dir,
    };
    app.manage(state);
    let handle = app.clone();
    std::thread::spawn(move || worker(handle));
    let handle = app.clone();
    std::thread::spawn(move || auto_update_ytdlp(&handle));
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| setup(app.handle()))
        .invoke_handler(tauri::generate_handler![
            get_metadata,
            enqueue,
            cancel,
            jobs,
            clear_finished,
            history,
            clear_history,
            open_entry,
            settings,
            choose_output_dir,
            set_auto_update,
            update_ytdlp,
            check_app_update,
            open_release,
            about
        ])
        .build(tauri::generate_context!())
        .expect("error while building dltube")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                // Stop yt-dlp/ffmpeg and let the worker delete partial files before quitting.
                let st = app.state::<App>();
                let running = |st: &App| st.jobs.lock().unwrap().iter().any(|j| j.status == Status::Running);
                for job in st.jobs.lock().unwrap().iter() {
                    job.cancel.store(true, Ordering::SeqCst);
                }
                let deadline = Instant::now() + Duration::from_secs(5);
                while running(&st) && Instant::now() < deadline {
                    std::thread::sleep(Duration::from_millis(100));
                }
            }
        });
}
