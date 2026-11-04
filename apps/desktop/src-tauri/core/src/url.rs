//! Port of `validate_youtube_url` in apps/api/app/services/youtube.py.

/// Cheap, deterministic check before anything reaches yt-dlp. Only http(s) links to
/// youtube.com (any subdomain) or youtu.be are accepted.
pub fn is_youtube_url(url: &str) -> bool {
    let url = url.trim();
    if url.is_empty() || url.len() > 2048 || url.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return false;
    }
    let (scheme, rest) = match url.split_once("://") {
        Some((scheme, rest)) => (scheme.to_ascii_lowercase(), rest),
        None => ("https".to_string(), url),
    };
    if scheme != "http" && scheme != "https" {
        return false;
    }
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    if authority.contains('@') {
        return false; // userinfo could hide the real host
    }
    let host = authority.split(':').next().unwrap_or("").to_ascii_lowercase();
    host == "youtu.be" || host == "youtube.com" || host.ends_with(".youtube.com")
}

/// The URL as passed to yt-dlp (scheme added when missing).
pub fn normalize(url: &str) -> String {
    let url = url.trim();
    if url.contains("://") {
        url.to_string()
    } else {
        format!("https://{url}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_youtube_hosts() {
        for ok in [
            "https://www.youtube.com/watch?v=jNQXAC9IVRw",
            "http://youtube.com/watch?v=x",
            "https://m.youtube.com/watch?v=x&list=PL1",
            "https://music.youtube.com/watch?v=x",
            "https://youtu.be/jNQXAC9IVRw",
            "youtu.be/jNQXAC9IVRw",
            "HTTPS://WWW.YOUTUBE.COM/shorts/abc",
        ] {
            assert!(is_youtube_url(ok), "{ok}");
        }
    }

    #[test]
    fn rejects_everything_else() {
        for bad in [
            "",
            "--exec=rm",
            "-o /etc/x",
            "file:///etc/passwd",
            "ftp://youtube.com/x",
            "https://youtube.com.evil.com/watch",
            "https://evilyoutube.com/watch",
            "https://youtube.com@evil.com/",
            "https://www.youtube.com/watch?v=x y",
            "https://vimeo.com/1",
        ] {
            assert!(!is_youtube_url(bad), "{bad}");
        }
        assert!(!is_youtube_url(&format!("https://youtu.be/{}", "a".repeat(2048))));
    }

    #[test]
    fn normalize_adds_scheme() {
        assert_eq!(normalize(" youtu.be/x "), "https://youtu.be/x");
        assert_eq!(normalize("http://youtu.be/x"), "http://youtu.be/x");
    }
}
