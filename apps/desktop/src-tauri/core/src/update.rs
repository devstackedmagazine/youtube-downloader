//! Keeps yt-dlp current (YouTube changes often) and checks for new dltube releases.
//! Only unauthenticated GitHub API/download requests; nothing about the user is sent.
use crate::{checksum, runner, version};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub const YTDLP_REPO: &str = "yt-dlp/yt-dlp";
pub const CHECK_INTERVAL_SECS: u64 = 24 * 60 * 60;
const MAX_BINARY_BYTES: u64 = 200 * 1024 * 1024;
const USER_AGENT: &str = concat!("dltube-desktop/", env!("CARGO_PKG_VERSION"));

/// yt-dlp's release asset for this platform.
pub fn ytdlp_asset_name() -> &'static str {
    if cfg!(windows) {
        "yt-dlp.exe"
    } else if cfg!(target_os = "macos") {
        "yt-dlp_macos"
    } else {
        "yt-dlp_linux"
    }
}

pub fn exe_name(name: &str) -> String {
    if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    }
}

/// Persisted in the app-data dir next to the managed yt-dlp.
#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
pub struct State {
    pub version: String,
    /// Unix seconds of the last update check.
    pub last_check: u64,
    pub auto_update: bool,
}

pub struct Managed {
    pub dir: PathBuf,
}

impl Managed {
    pub fn new(app_data: &Path) -> Self {
        Managed { dir: app_data.join("yt-dlp") }
    }
    pub fn binary(&self) -> PathBuf {
        self.dir.join(exe_name("yt-dlp"))
    }
    fn backup(&self) -> PathBuf {
        self.dir.join(exe_name("yt-dlp.previous"))
    }
    fn state_path(&self) -> PathBuf {
        self.dir.join("state.json")
    }

    pub fn state(&self) -> State {
        fs::read_to_string(self.state_path())
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or(State { auto_update: true, ..State::default() })
    }

    pub fn save_state(&self, state: &State) -> io::Result<()> {
        fs::create_dir_all(&self.dir)?;
        let tmp = self.dir.join("state.json.tmp");
        fs::write(&tmp, serde_json::to_vec_pretty(state)?)?;
        fs::rename(tmp, self.state_path())
    }

    /// First run (or an app update that bundles a newer yt-dlp): copy the bundled binary into the
    /// writable app-data dir, since the install dir may not be writable. Returns the binary to use.
    pub fn ensure(&self, bundled: &Path, bundled_version: &str) -> io::Result<PathBuf> {
        let mut state = self.state();
        let target = self.binary();
        if target.is_file() && !version::is_newer(bundled_version, &state.version) {
            return Ok(target);
        }
        fs::create_dir_all(&self.dir)?;
        let tmp = self.dir.join(exe_name("yt-dlp.copying"));
        fs::copy(bundled, &tmp)?;
        make_executable(&tmp)?;
        fs::rename(&tmp, &target)?;
        state.version = bundled_version.to_string();
        self.save_state(&state)?;
        Ok(target)
    }

    /// Swap in a verified new binary: current -> backup, new -> current. If the result fails
    /// `--version`, the backup is restored.
    pub fn install(&self, new_binary: &Path, expected_version: &str) -> Result<String, String> {
        let check = |path: &Path| runner::tool_version(path, "--version");
        match check(new_binary) {
            Some(v) if v == expected_version => {}
            other => {
                let _ = fs::remove_file(new_binary);
                return Err(format!("The new yt-dlp failed its self-check ({other:?}); keeping the current version."));
            }
        }
        let (current, backup) = (self.binary(), self.backup());
        let had_current = current.is_file();
        if had_current {
            let _ = fs::remove_file(&backup);
            fs::rename(&current, &backup).map_err(|e| e.to_string())?;
        }
        if let Err(e) = fs::rename(new_binary, &current) {
            if had_current {
                let _ = fs::rename(&backup, &current);
            }
            return Err(e.to_string());
        }
        if check(&current).as_deref() != Some(expected_version) {
            let _ = fs::remove_file(&current);
            if had_current {
                let _ = fs::rename(&backup, &current);
            }
            return Err("The new yt-dlp didn't start; rolled back to the previous version.".into());
        }
        let mut state = self.state();
        state.version = expected_version.to_string();
        self.save_state(&state).map_err(|e| e.to_string())?;
        Ok(expected_version.to_string())
    }

    /// Download, verify against SHA2-256SUMS and install `release` if it's newer.
    /// Returns the installed version, or None when already current.
    pub fn update_to(&self, release: &YtdlpRelease) -> Result<Option<String>, String> {
        if !version::is_newer(&release.version, &self.state().version) {
            return Ok(None);
        }
        let sums = String::from_utf8(get_bytes(&release.sums_url, 1024 * 1024)?).map_err(|e| e.to_string())?;
        let expected = checksum::find_in_sums(&sums, ytdlp_asset_name())
            .ok_or("The yt-dlp release has no checksum for this platform.")?;
        fs::create_dir_all(&self.dir).map_err(|e| e.to_string())?;
        let tmp = self.dir.join(exe_name("yt-dlp.download"));
        download_to(&release.binary_url, &tmp)?;
        let actual = checksum::sha256_file(&tmp).map_err(|e| e.to_string())?;
        if actual != expected {
            let _ = fs::remove_file(&tmp);
            return Err("The downloaded yt-dlp didn't match its published checksum; it was discarded.".into());
        }
        make_executable(&tmp).map_err(|e| e.to_string())?;
        self.install(&tmp, &release.version).map(Some)
    }
}

pub fn make_executable(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o755))?;
    }
    let _ = path;
    Ok(())
}

pub fn should_check(state: &State, now: u64) -> bool {
    state.auto_update && now.saturating_sub(state.last_check) >= CHECK_INTERVAL_SECS
}

#[derive(Debug, PartialEq)]
pub struct YtdlpRelease {
    pub version: String,
    pub binary_url: String,
    pub sums_url: String,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct AppRelease {
    pub version: String,
    pub url: String,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    html_url: String,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    assets: Vec<GhAsset>,
}

#[derive(Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

fn agent() -> ureq::Agent {
    ureq::Agent::config_builder()
        .timeout_global(Some(Duration::from_secs(300)))
        .user_agent(USER_AGENT)
        .https_only(true)
        .build()
        .into()
}

fn get_bytes(url: &str, limit: u64) -> Result<Vec<u8>, String> {
    let mut response = agent().get(url).call().map_err(|e| format!("Update check failed: {e}"))?;
    let mut bytes = Vec::new();
    response.body_mut().as_reader().take(limit + 1).read_to_end(&mut bytes).map_err(|e| e.to_string())?;
    if bytes.len() as u64 > limit {
        return Err("Download is larger than expected.".into());
    }
    Ok(bytes)
}

fn download_to(url: &str, dest: &Path) -> Result<(), String> {
    let result = (|| {
        let mut response = agent().get(url).call().map_err(|e| format!("Download failed: {e}"))?;
        let mut file = fs::File::create(dest).map_err(|e| e.to_string())?;
        let copied = io::copy(&mut response.body_mut().as_reader().take(MAX_BINARY_BYTES + 1), &mut file)
            .map_err(|e| e.to_string())?;
        if copied > MAX_BINARY_BYTES {
            return Err("Download is larger than expected.".to_string());
        }
        file.sync_all().map_err(|e| e.to_string())
    })();
    if result.is_err() {
        let _ = fs::remove_file(dest);
    }
    result
}

fn latest_release(repo: &str) -> Result<GhRelease, String> {
    let body = get_bytes(&format!("https://api.github.com/repos/{repo}/releases/latest"), 2 * 1024 * 1024)?;
    serde_json::from_slice(&body).map_err(|e| format!("Unexpected GitHub answer: {e}"))
}

fn ytdlp_release_from(release: GhRelease) -> Result<YtdlpRelease, String> {
    let asset = |name: &str| {
        release
            .assets
            .iter()
            .find(|a| a.name == name)
            .map(|a| a.browser_download_url.clone())
            .filter(|u| u.starts_with("https://github.com/"))
            .ok_or(format!("yt-dlp release {} has no {name}", release.tag_name))
    };
    Ok(YtdlpRelease {
        binary_url: asset(ytdlp_asset_name())?,
        sums_url: asset("SHA2-256SUMS")?,
        version: release.tag_name.clone(),
    })
}

pub fn latest_ytdlp() -> Result<YtdlpRelease, String> {
    ytdlp_release_from(latest_release(YTDLP_REPO)?)
}

fn app_release_from(release: GhRelease, current: &str) -> Option<AppRelease> {
    let newer = !release.draft && !release.prerelease && version::is_newer(&release.tag_name, current);
    let url_ok = release.html_url.starts_with("https://github.com/");
    (newer && url_ok).then(|| AppRelease {
        version: version::parse(&release.tag_name)
            .map_or(release.tag_name.clone(), |v| v.iter().map(u64::to_string).collect::<Vec<_>>().join(".")),
        url: release.html_url,
    })
}

/// A newer dltube release on GitHub, if any. v1 only links to it (no auto-install, no signing keys).
pub fn check_app(repo: &str, current: &str) -> Result<Option<AppRelease>, String> {
    Ok(app_release_from(latest_release(repo)?, current))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gh(json: &str) -> GhRelease {
        serde_json::from_str(json).unwrap()
    }

    const YTDLP_JSON: &str = r#"{"tag_name":"2026.11.01","html_url":"https://github.com/yt-dlp/yt-dlp/releases/tag/2026.11.01","assets":[
        {"name":"SHA2-256SUMS","browser_download_url":"https://github.com/yt-dlp/yt-dlp/releases/download/2026.11.01/SHA2-256SUMS"},
        {"name":"yt-dlp.exe","browser_download_url":"https://github.com/yt-dlp/yt-dlp/releases/download/2026.11.01/yt-dlp.exe"},
        {"name":"yt-dlp_linux","browser_download_url":"https://github.com/yt-dlp/yt-dlp/releases/download/2026.11.01/yt-dlp_linux"},
        {"name":"yt-dlp_macos","browser_download_url":"https://github.com/yt-dlp/yt-dlp/releases/download/2026.11.01/yt-dlp_macos"}]}"#;

    #[test]
    fn picks_platform_asset_and_sums() {
        let r = ytdlp_release_from(gh(YTDLP_JSON)).unwrap();
        assert_eq!(r.version, "2026.11.01");
        assert!(r.binary_url.ends_with(&format!("/{}", ytdlp_asset_name())));
        assert!(r.sums_url.ends_with("/SHA2-256SUMS"));
        let missing = gh(r#"{"tag_name":"x","html_url":"https://github.com/","assets":[]}"#);
        assert!(ytdlp_release_from(missing).is_err());
        let foreign = YTDLP_JSON
            .replace("https://github.com/yt-dlp/yt-dlp/releases/download/2026.11.01/SHA2", "http://evil/SHA2");
        assert!(ytdlp_release_from(gh(&foreign)).is_err());
    }

    #[test]
    fn app_release_detection() {
        let json = |tag: &str, extra: &str| {
            format!(r#"{{"tag_name":"{tag}","html_url":"https://github.com/o/r/releases/tag/{tag}"{extra}}}"#)
        };
        let newer = app_release_from(gh(&json("desktop-v0.2.0", "")), "0.1.0").unwrap();
        assert_eq!(
            newer,
            AppRelease { version: "0.2.0".into(), url: "https://github.com/o/r/releases/tag/desktop-v0.2.0".into() }
        );
        assert_eq!(app_release_from(gh(&json("desktop-v0.1.0", "")), "0.1.0"), None);
        assert_eq!(app_release_from(gh(&json("desktop-v0.3.0", r#","prerelease":true"#)), "0.1.0"), None);
        assert_eq!(app_release_from(gh(&json("desktop-v0.3.0", r#","draft":true"#)), "0.1.0"), None);
    }

    #[test]
    fn daily_check() {
        let state = State { version: "1".into(), last_check: 1_000, auto_update: true };
        assert!(!should_check(&state, 1_000 + CHECK_INTERVAL_SECS - 1));
        assert!(should_check(&state, 1_000 + CHECK_INTERVAL_SECS));
        assert!(!should_check(&State { auto_update: false, ..state }, u64::MAX));
    }

    #[cfg(unix)]
    fn fake_ytdlp(path: &Path, version: &str) {
        fs::write(path, format!("#!/bin/sh\necho {version}\n")).unwrap();
        make_executable(path).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn ensure_copies_bundled_once_and_upgrades_with_app() {
        let dir = tempfile::tempdir().unwrap();
        let bundled = dir.path().join("bundled");
        fake_ytdlp(&bundled, "2026.10.26");
        let managed = Managed::new(&dir.path().join("data"));
        let bin = managed.ensure(&bundled, "2026.10.26").unwrap();
        assert_eq!(runner::tool_version(&bin, "--version").as_deref(), Some("2026.10.26"));
        assert!(managed.state().auto_update);

        // A self-updated newer copy is kept when the bundled one is older...
        let newer = dir.path().join("newer");
        fake_ytdlp(&newer, "2026.11.01");
        managed.install(&newer, "2026.11.01").unwrap();
        managed.ensure(&bundled, "2026.10.26").unwrap();
        assert_eq!(runner::tool_version(&bin, "--version").as_deref(), Some("2026.11.01"));
        // ...and replaced when an app update bundles something newer still.
        fake_ytdlp(&bundled, "2026.12.01");
        managed.ensure(&bundled, "2026.12.01").unwrap();
        assert_eq!(managed.state().version, "2026.12.01");
    }

    #[cfg(unix)]
    #[test]
    fn install_rejects_broken_binary_and_keeps_current() {
        let dir = tempfile::tempdir().unwrap();
        let bundled = dir.path().join("bundled");
        fake_ytdlp(&bundled, "2026.10.26");
        let managed = Managed::new(dir.path());
        managed.ensure(&bundled, "2026.10.26").unwrap();

        let broken = dir.path().join("broken");
        fs::write(&broken, "#!/bin/sh\nexit 3\n").unwrap();
        make_executable(&broken).unwrap();
        assert!(managed.install(&broken, "2026.11.01").is_err());
        assert!(!broken.exists());
        let wrong = dir.path().join("wrong");
        fake_ytdlp(&wrong, "1999.01.01");
        assert!(managed.install(&wrong, "2026.11.01").is_err());
        assert_eq!(runner::tool_version(&managed.binary(), "--version").as_deref(), Some("2026.10.26"));
        assert_eq!(managed.state().version, "2026.10.26");
    }
}
