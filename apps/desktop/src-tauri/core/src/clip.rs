//! Section rules. Same as checkClip in packages/shared/src/time.ts and DownloadCreate in
//! apps/api, minus the server-only length limit.

pub const MIN_CLIP_SECONDS: f64 = 1.0;
/// YouTube reports whole seconds; an end time this far past the duration is accepted.
pub const DURATION_TOLERANCE_SECONDS: f64 = 1.0;

/// Validate an optional `[start, end)` section of a video. `duration` 0 means unknown.
pub fn validate(
    start: Option<f64>,
    end: Option<f64>,
    duration: f64,
    is_playlist: bool,
    is_live: bool,
) -> Result<(), String> {
    if start.is_none() && end.is_none() {
        return Ok(());
    }
    if is_playlist {
        return Err("Sections can only be downloaded from a single video, not a playlist.".into());
    }
    if is_live {
        return Err("Sections of live streams can't be downloaded.".into());
    }
    let begin = start.unwrap_or(0.0);
    if !begin.is_finite() || begin < 0.0 || end.is_some_and(|e| !e.is_finite() || e < 0.0) {
        return Err("Start and end must be positive times.".into());
    }
    if duration > 0.0 && begin >= duration {
        return Err("Start time is past the end of the video.".into());
    }
    let stop = match end {
        Some(e) if duration > 0.0 && e > duration + DURATION_TOLERANCE_SECONDS => {
            return Err("End time is past the end of the video.".into())
        }
        Some(e) => e,
        None if duration > 0.0 => duration,
        None => f64::INFINITY,
    };
    if begin >= stop {
        return Err("Start time must be before end time.".into());
    }
    if length(start, end, duration) < MIN_CLIP_SECONDS {
        return Err("The section must be at least 1 second long.".into());
    }
    Ok(())
}

/// Seconds actually processed (end is clamped to the duration when it is known).
pub fn length(start: Option<f64>, end: Option<f64>, duration: f64) -> f64 {
    let stop = match end {
        Some(e) if duration > 0.0 => e.min(duration),
        Some(e) => e,
        None => duration,
    };
    (stop - start.unwrap_or(0.0)).max(0.0)
}

/// The `--download-sections` value, e.g. `*5-12` or `*300-inf`.
pub fn section_arg(start: Option<f64>, end: Option<f64>) -> String {
    let end = end.map_or("inf".to_string(), |e| e.to_string());
    format!("*{}-{}", start.unwrap_or(0.0), end)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn whole_video_needs_no_checks() {
        assert!(validate(None, None, 0.0, true, true).is_ok());
    }

    #[test]
    fn valid_sections() {
        assert!(validate(Some(5.0), Some(12.0), 19.0, false, false).is_ok());
        assert!(validate(Some(5.0), None, 19.0, false, false).is_ok());
        assert!(validate(None, Some(12.0), 19.0, false, false).is_ok());
        assert!(validate(Some(0.0), Some(19.8), 19.0, false, false).is_ok()); // within tolerance
        assert!(validate(Some(300.0), Some(330.0), 596.0, false, false).is_ok());
    }

    #[test]
    fn invalid_sections() {
        let err = |s, e, d| validate(s, e, d, false, false).unwrap_err();
        assert!(err(Some(12.0), Some(5.0), 19.0).contains("before end"));
        assert!(err(Some(5.0), Some(5.5), 19.0).contains("at least 1 second"));
        assert!(err(Some(5.0), Some(25.0), 19.0).contains("past the end"));
        assert!(err(Some(19.0), None, 19.0).contains("past the end"));
        assert!(err(Some(18.5), None, 19.0).contains("at least 1 second"));
        assert!(err(Some(-1.0), None, 19.0).contains("positive"));
        assert!(err(Some(f64::NAN), None, 19.0).contains("positive"));
        assert!(validate(Some(1.0), None, 19.0, true, false).unwrap_err().contains("playlist"));
        assert!(validate(Some(1.0), None, 19.0, false, true).unwrap_err().contains("live"));
    }

    #[test]
    fn length_and_arg() {
        assert_eq!(length(Some(5.0), Some(12.0), 19.0), 7.0);
        assert_eq!(length(Some(5.0), None, 19.0), 14.0);
        assert_eq!(length(None, Some(30.0), 19.0), 19.0);
        assert_eq!(section_arg(Some(5.0), Some(12.0)), "*5-12");
        assert_eq!(section_arg(Some(300.0), None), "*300-inf");
        assert_eq!(section_arg(None, Some(7.5)), "*0-7.5");
    }
}
