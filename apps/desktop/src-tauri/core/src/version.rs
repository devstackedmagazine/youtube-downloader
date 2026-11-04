//! Version comparison for yt-dlp ("2026.10.26", "2026.10.26.1") and dltube ("0.1.0", "desktop-v0.2.0").

/// Numeric parts of a version, ignoring a leading `v`/`desktop-v`. None if it isn't
/// purely dotted numbers (pre-releases like "1.0.0-beta" are never treated as newer).
pub fn parse(version: &str) -> Option<Vec<u64>> {
    let v = version.trim();
    let v = v.strip_prefix("desktop-").unwrap_or(v);
    let v = v.strip_prefix('v').unwrap_or(v);
    v.split('.').map(|part| part.parse().ok()).collect()
}

/// True if `candidate` is a strictly newer version than `current`.
pub fn is_newer(candidate: &str, current: &str) -> bool {
    match (parse(candidate), parse(current)) {
        (Some(mut a), Some(mut b)) => {
            let len = a.len().max(b.len());
            a.resize(len, 0);
            b.resize(len, 0);
            a > b
        }
        // Unknown current version (e.g. a broken binary): any valid release is an upgrade.
        (Some(_), None) => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_ytdlp_versions() {
        assert!(is_newer("2026.10.26", "2026.9.30"));
        assert!(is_newer("2026.10.26.1", "2026.10.26"));
        assert!(is_newer("2027.01.01", "2026.12.31"));
        assert!(!is_newer("2026.10.26", "2026.10.26"));
        assert!(!is_newer("2026.10.26", "2026.10.26.0"));
        assert!(!is_newer("2026.01.02", "2026.10.26"));
        assert!(is_newer("2026.10.26", "garbage"));
        assert!(!is_newer("garbage", "2026.10.26"));
    }

    #[test]
    fn compares_app_versions() {
        assert!(is_newer("desktop-v0.2.0", "0.1.0"));
        assert!(is_newer("v0.1.1", "0.1.0"));
        assert!(is_newer("0.10.0", "0.9.9"));
        assert!(!is_newer("desktop-v0.1.0", "0.1.0"));
        assert!(!is_newer("desktop-v0.2.0-beta", "0.1.0"));
    }
}
