//! Everything the dltube desktop app does with yt-dlp, kept free of Tauri so it can be unit
//! tested and driven headless (see src/bin/dltube-cli.rs).
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub mod args;
pub mod checksum;
pub mod clip;
pub mod errors;
pub mod filename;
pub mod progress;
pub mod runner;
pub mod update;
pub mod url;
pub mod version;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    Mp4,
    Mp3,
}

/// Absolute paths of the bundled tools. Never anything from the user's PATH.
#[derive(Clone, Debug)]
pub struct Tools {
    pub ytdlp: PathBuf,
    pub ffmpeg: PathBuf,
    pub ffprobe: PathBuf,
    pub deno: PathBuf,
    pub cache_dir: PathBuf,
}

/// One download job, as sent by the UI. `quality` is checked against an allow-list in args.rs.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Request {
    pub url: String,
    pub format: Format,
    pub quality: String,
    /// Download every playlist item into a subfolder.
    pub playlist: bool,
    pub start: Option<f64>,
    pub end: Option<f64>,
    /// Video or playlist title from the metadata lookup; only used (sanitized) for file names.
    pub title: String,
    /// Seconds, 0 if unknown.
    pub duration: f64,
}

/// Same shape as the web app's VideoMetadata (packages/shared/src/types.ts).
#[derive(Clone, Debug, Serialize, PartialEq)]
pub struct Metadata {
    pub id: String,
    pub title: String,
    pub duration: f64,
    pub thumbnail: String,
    pub channel: String,
    pub is_live: bool,
    pub is_playlist: bool,
    pub playlist_count: u64,
    pub playlist_title: Option<String>,
}
