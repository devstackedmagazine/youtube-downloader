//! Turn yt-dlp/ffmpeg/OS errors into messages a user can act on.
use std::io;

pub const CANCELLED: &str = "Download cancelled.";

/// Map yt-dlp's stderr to a friendly message.
pub fn friendly(stderr: &str) -> String {
    let lower = stderr.to_lowercase();
    let has = |needles: &[&str]| needles.iter().any(|n| lower.contains(n));

    if has(&["http error 429", "too many requests"]) {
        return "YouTube is temporarily limiting requests from your internet connection. \
                Wait a while (often an hour), then try again."
            .into();
    }
    if has(&["confirm you"]) && has(&["not a bot"]) {
        return "YouTube asked to confirm you're not a bot. Wait a few minutes, then try again. \
                (Signing in isn't supported.)"
            .into();
    }
    if has(&["private video"]) {
        return "This video is private.".into();
    }
    if has(&["confirm your age", "age-restricted", "inappropriate for some users"]) {
        return "This video is age-restricted and can't be downloaded without signing in.".into();
    }
    if has(&["members-only", "join this channel"]) {
        return "This video is for channel members only.".into();
    }
    if has(&["live event will begin", "premieres in", "is live", "live stream"]) {
        return "Live streams and premieres can't be downloaded until they have ended.".into();
    }
    if has(&["no space left", "not enough space", "disk full", "errno 28"]) {
        return "Your disk is full. Free up some space or choose another download folder.".into();
    }
    if has(&["permission denied", "access is denied"]) {
        return "dltube can't write to the download folder. Choose another folder in Settings.".into();
    }
    if has(&[
        "getaddrinfo",
        "name or service not known",
        "temporary failure in name resolution",
        "no address associated",
        "network is unreachable",
        "failed to resolve",
        "connection refused",
        "connection reset",
        "timed out",
        "errno 11001",
        "unable to connect",
    ]) {
        return "Can't reach YouTube. Check your internet connection and try again.".into();
    }
    if has(&["requested format is not available"]) {
        return "That quality isn't available for this video. Pick a lower one.".into();
    }
    if has(&["video unavailable", "not available", "has been removed", "does not exist", "http error 404"]) {
        return "This video is unavailable. It may have been removed or blocked in your country.".into();
    }
    if has(&["unsupported url", "is not a valid url"]) {
        return "That doesn't look like a YouTube video or playlist link.".into();
    }
    // Fall back to yt-dlp's own last error line.
    let last = stderr
        .lines()
        .rev()
        .find(|l| l.contains("ERROR"))
        .or_else(|| stderr.lines().rev().find(|l| !l.trim().is_empty()));
    match last {
        Some(line) => {
            let line = line.trim().trim_start_matches("ERROR:").trim();
            format!("The download failed: {}", line.chars().take(300).collect::<String>())
        }
        None => "The download failed for an unknown reason.".into(),
    }
}

pub fn from_io(error: &io::Error) -> String {
    match error.kind() {
        io::ErrorKind::StorageFull => friendly("no space left"),
        io::ErrorKind::PermissionDenied => friendly("permission denied"),
        _ => format!("A file operation failed: {error}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_errors() {
        let cases = [
            ("ERROR: [youtube] x: Sign in to confirm you’re not a bot. Use --cookies", "not a bot"),
            ("ERROR: [youtube] x: Sign in to confirm you're not a bot.", "not a bot"),
            (
                "WARNING: HTTP Error 429: Too Many Requests\nERROR: [youtube] x: Sign in to confirm you're not a bot",
                "limiting",
            ),
            ("ERROR: [youtube] x: Private video. Sign in if you've been granted access", "private"),
            ("ERROR: [youtube] x: Sign in to confirm your age. This video may be inappropriate", "age-restricted"),
            ("ERROR: [youtube] x: Video unavailable. This video has been removed by the uploader", "unavailable"),
            ("ERROR: [youtube] x: This live event will begin in 3 hours.", "Live streams"),
            (
                "ERROR: unable to download video data: <urlopen error [Errno -3] Temporary failure in name resolution>",
                "internet",
            ),
            ("ERROR: Unable to download webpage: <urlopen error [Errno 11001] getaddrinfo failed>", "internet"),
            ("ERROR: Postprocessing: [Errno 28] No space left on device", "disk is full"),
            ("OSError: [WinError 112] There is not enough space on the disk", "disk is full"),
            ("ERROR: Unsupported URL: https://youtube.com/foo", "doesn't look like"),
            ("ERROR: [youtube] x: Requested format is not available. Use --list-formats", "quality"),
        ];
        for (stderr, expected) in cases {
            assert!(friendly(stderr).contains(expected), "{stderr} -> {}", friendly(stderr));
        }
    }

    #[test]
    fn falls_back_to_last_error_line() {
        assert_eq!(friendly("WARNING: a\nERROR: something odd\n"), "The download failed: something odd");
        assert_eq!(friendly(""), "The download failed for an unknown reason.");
    }

    #[test]
    fn maps_io_errors() {
        assert!(from_io(&io::Error::from(io::ErrorKind::StorageFull)).contains("disk is full"));
        assert!(from_io(&io::Error::from(io::ErrorKind::PermissionDenied)).contains("Settings"));
    }
}
