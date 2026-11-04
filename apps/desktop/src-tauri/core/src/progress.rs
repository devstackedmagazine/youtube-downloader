//! Machine-readable progress from yt-dlp's `--progress-template`.
use serde::Serialize;

pub const PREFIX: &str = "dltube-progress";
/// Space-separated so it is trivial to parse; missing fields print as "NA".
pub const TEMPLATE: &str = "download:dltube-progress %(info.playlist_index)s %(info.n_entries)s %(progress.status)s \
%(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s";
/// `--print after_move:` marker for every finished file.
pub const FILE_PREFIX: &str = "dltube-file:";

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub struct Progress {
    /// 0-100, None while the size is unknown (e.g. ffmpeg cutting a section).
    pub percent: Option<f64>,
    pub downloaded_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    /// Bytes per second.
    pub speed: Option<f64>,
    pub eta_seconds: Option<u64>,
    /// 1-based playlist item and the item count (playlists only).
    pub item: Option<u32>,
    pub items: Option<u32>,
    /// yt-dlp's status: "downloading" or "finished".
    pub status: String,
}

fn num(field: &str) -> Option<f64> {
    field.parse::<f64>().ok().filter(|n| n.is_finite() && *n >= 0.0)
}

/// Parse one stdout line; None if it isn't a progress line.
pub fn parse_line(line: &str) -> Option<Progress> {
    let rest = line.trim().strip_prefix(PREFIX)?.strip_prefix(' ')?;
    let f: Vec<&str> = rest.split(' ').collect();
    if f.len() != 8 {
        return None;
    }
    let downloaded = num(f[3]).map(|n| n as u64);
    let total = num(f[4]).or_else(|| num(f[5])).map(|n| n as u64).filter(|t| *t > 0);
    let percent = match (downloaded, total) {
        (Some(d), Some(t)) => Some((d as f64 / t as f64 * 100.0).min(100.0)),
        _ if f[2] == "finished" => Some(100.0),
        _ => None,
    };
    Some(Progress {
        percent,
        downloaded_bytes: downloaded,
        total_bytes: total,
        speed: num(f[6]),
        eta_seconds: num(f[7]).map(|n| n as u64),
        item: num(f[0]).map(|n| n as u32),
        items: num(f[1]).map(|n| n as u32),
        status: f[2].to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_single_video_progress() {
        let p = parse_line("dltube-progress NA NA downloading 524288 1048576 NA 250000.5 2").unwrap();
        assert_eq!(p.percent, Some(50.0));
        assert_eq!(p.downloaded_bytes, Some(524288));
        assert_eq!(p.total_bytes, Some(1048576));
        assert_eq!(p.speed, Some(250000.5));
        assert_eq!(p.eta_seconds, Some(2));
        assert_eq!((p.item, p.items), (None, None));
    }

    #[test]
    fn uses_estimate_and_playlist_counter() {
        let p = parse_line("dltube-progress 3 12 downloading 100 NA 400.7 NA NA").unwrap();
        assert_eq!(p.total_bytes, Some(400));
        assert_eq!(p.percent, Some(25.0));
        assert_eq!((p.item, p.items), (Some(3), Some(12)));
        assert_eq!(p.speed, None);
    }

    #[test]
    fn unknown_size_and_finished() {
        let p = parse_line("dltube-progress NA NA downloading 2048 NA NA NA NA").unwrap();
        assert_eq!(p.percent, None);
        let p = parse_line("dltube-progress NA NA finished 2048 NA NA NA NA").unwrap();
        assert_eq!(p.percent, Some(100.0));
    }

    #[test]
    fn ignores_other_lines() {
        assert_eq!(parse_line("[youtube] jNQXAC9IVRw: Downloading webpage"), None);
        assert_eq!(parse_line("dltube-progress 1 2 3"), None);
        assert_eq!(parse_line("dltube-progressive NA NA a 1 2 3 4 5"), None);
    }
}
