//! Output names, ported from output_filename/format_offset in apps/api/app/tasks/convert_video.py.
use std::path::{Path, PathBuf};

const RESERVED: [&str; 22] = [
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2",
    "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

/// A file or folder name that is valid on Windows and Linux.
pub fn sanitize(title: &str) -> String {
    let cleaned: String =
        title.chars().map(|c| if c.is_control() || r#"<>:"/\|?*"#.contains(c) { '_' } else { c }).take(150).collect();
    // No leading dot (hidden file on Linux), no trailing dot or space (invalid on Windows).
    let cleaned = cleaned.trim_matches(['.', ' ']).trim().to_string();
    if cleaned.is_empty() || cleaned.chars().all(|c| c == '.' || c == '_') {
        return "download".into();
    }
    let stem = cleaned.split('.').next().unwrap_or("").trim().to_ascii_uppercase();
    if RESERVED.contains(&stem.as_str()) {
        return format!("_{cleaned}");
    }
    cleaned
}

/// 5 -> "00m05s", 3725 -> "1h02m05s".
pub fn format_offset(seconds: f64) -> String {
    let s = seconds.max(0.0) as u64;
    let (h, m, s) = (s / 3600, s / 60 % 60, s % 60);
    if h > 0 {
        format!("{h}h{m:02}m{s:02}s")
    } else {
        format!("{m:02}m{s:02}s")
    }
}

/// e.g. "Title [00m05s-00m12s].mp4" for a section, "Title.mp4" otherwise.
pub fn output_filename(title: &str, extension: &str, start: Option<f64>, end: Option<f64>, duration: f64) -> String {
    let mut name = sanitize(title);
    if start.is_some() || end.is_some() {
        let stop = end.or((duration > 0.0).then_some(duration));
        let stop = stop.map_or("end".to_string(), format_offset);
        name += &format!(" [{}-{}]", format_offset(start.unwrap_or(0.0)), stop);
    }
    format!("{name}.{extension}")
}

/// `dir/name`, or `dir/name (2)` etc. if that already exists. Never overwrites.
pub fn unique_path(dir: &Path, name: &str) -> PathBuf {
    let candidate = dir.join(name);
    if !candidate.exists() {
        return candidate;
    }
    let path = Path::new(name);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(name);
    let ext = path.extension().and_then(|e| e.to_str()).map(|e| format!(".{e}")).unwrap_or_default();
    (2..).map(|n| dir.join(format!("{stem} ({n}){ext}"))).find(|p| !p.exists()).expect("unbounded range")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_names() {
        assert_eq!(sanitize("Me at the zoo"), "Me at the zoo");
        assert_eq!(sanitize("a/b\\c:d*e?f\"g<h>i|j"), "a_b_c_d_e_f_g_h_i_j");
        assert_eq!(sanitize("../../etc/passwd"), "_.._etc_passwd");
        assert_eq!(sanitize("  dots... "), "dots");
        assert_eq!(sanitize(""), "download");
        assert_eq!(sanitize(".."), "download");
        assert_eq!(sanitize("CON"), "_CON");
        assert_eq!(sanitize("nul.txt"), "_nul.txt");
        assert_eq!(sanitize("tab\there"), "tab_here");
        assert_eq!(sanitize(&"é".repeat(300)).chars().count(), 150);
    }

    #[test]
    fn offsets_and_names() {
        assert_eq!(format_offset(5.0), "00m05s");
        assert_eq!(format_offset(300.0), "05m00s");
        assert_eq!(format_offset(3725.0), "1h02m05s");
        assert_eq!(output_filename("Me at the zoo", "mp4", None, None, 19.0), "Me at the zoo.mp4");
        assert_eq!(
            output_filename("Me at the zoo", "mp3", Some(5.0), Some(12.0), 19.0),
            "Me at the zoo [00m05s-00m12s].mp3"
        );
        assert_eq!(output_filename("x", "mp4", Some(5.0), None, 19.0), "x [00m05s-00m19s].mp4");
        assert_eq!(output_filename("x", "mp4", Some(5.0), None, 0.0), "x [00m05s-end].mp4");
        assert_eq!(output_filename("x", "mp4", None, Some(12.0), 19.0), "x [00m00s-00m12s].mp4");
    }

    #[test]
    fn unique_path_never_overwrites() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(unique_path(dir.path(), "a.mp4"), dir.path().join("a.mp4"));
        std::fs::write(dir.path().join("a.mp4"), "").unwrap();
        std::fs::write(dir.path().join("a (2).mp4"), "").unwrap();
        assert_eq!(unique_path(dir.path(), "a.mp4"), dir.path().join("a (3).mp4"));
        std::fs::create_dir(dir.path().join("folder")).unwrap();
        assert_eq!(unique_path(dir.path(), "folder"), dir.path().join("folder (2)"));
    }
}
