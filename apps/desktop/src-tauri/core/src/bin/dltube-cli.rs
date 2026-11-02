//! Headless harness that drives the same code paths as the app (for real-download tests and CI).
//!
//!   dltube-cli <bin-dir> <out-dir> metadata <url> [--single]
//!   dltube-cli <bin-dir> <out-dir> download <url> <mp4|mp3> <quality> [start] [end] [--cancel-after <secs>]
//!
//! <bin-dir> holds the sidecars as fetched by scripts/fetch-sidecars.mjs (target-triple names).
use dltube_core::{runner, Format, Request, Tools};
use std::path::{Path, PathBuf};
use std::process::ExitCode;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

fn tool(bin_dir: &Path, name: &str) -> PathBuf {
    let triple = if cfg!(windows) { "x86_64-pc-windows-msvc.exe" } else { "x86_64-unknown-linux-gnu" };
    bin_dir.join(format!("{name}-{triple}"))
}

fn main() -> ExitCode {
    let mut args: Vec<String> = std::env::args().skip(1).collect();
    let flag_value = |args: &mut Vec<String>, flag: &str| {
        let i = args.iter().position(|a| a == flag)?;
        let value = args.get(i + 1).cloned();
        args.drain(i..(i + 2).min(args.len()));
        value
    };
    let cancel_after = flag_value(&mut args, "--cancel-after").and_then(|s| s.parse::<f64>().ok());
    let single = args.iter().any(|a| a == "--single");
    args.retain(|a| a != "--single");
    if args.len() < 4 {
        eprintln!("usage: see the top of src/bin/dltube-cli.rs");
        return ExitCode::from(2);
    }
    let (bin_dir, out_dir) = (PathBuf::from(&args[0]), PathBuf::from(&args[1]));
    let tools = Tools {
        ytdlp: tool(&bin_dir, "yt-dlp"),
        ffmpeg: tool(&bin_dir, "ffmpeg"),
        ffprobe: tool(&bin_dir, "ffprobe"),
        deno: tool(&bin_dir, "deno"),
        cache_dir: out_dir.join(".cache"),
    };
    let cancel = Arc::new(AtomicBool::new(false));
    let started = Instant::now();

    let result = match args[2].as_str() {
        "metadata" => runner::fetch_metadata(&tools, &args[3], single, &cancel)
            .map(|m| println!("{}", serde_json::to_string_pretty(&m).unwrap())),
        "download" if args.len() >= 6 => {
            let num = |i: usize| args.get(i).and_then(|s| s.parse::<f64>().ok());
            let format = if args[4] == "mp3" { Format::Mp3 } else { Format::Mp4 };
            let meta = match runner::fetch_metadata(&tools, &args[3], true, &cancel) {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("metadata failed: {e}");
                    return ExitCode::FAILURE;
                }
            };
            let req = Request {
                url: args[3].clone(),
                format,
                quality: args[5].clone(),
                playlist: false,
                start: num(6),
                end: num(7),
                title: meta.title,
                duration: meta.duration,
            };
            if let Some(secs) = cancel_after {
                let cancel = Arc::clone(&cancel);
                std::thread::spawn(move || {
                    std::thread::sleep(Duration::from_secs_f64(secs));
                    cancel.store(true, Ordering::SeqCst);
                });
            }
            let mut last = -10.0;
            runner::download(&tools, &req, &out_dir, &cancel, |p| {
                let pct = p.percent.unwrap_or(-1.0);
                if pct - last >= 10.0 || p.status != "downloading" {
                    last = pct;
                    println!(
                        "progress {:?} {} speed={:?} eta={:?}",
                        p.percent.map(|x| x.round()),
                        p.status,
                        p.speed,
                        p.eta_seconds
                    );
                }
            })
            .map(|files| files.iter().for_each(|f| println!("file {}", f.display())))
        }
        _ => {
            eprintln!("unknown command");
            return ExitCode::from(2);
        }
    };
    eprintln!("elapsed {:.1}s", started.elapsed().as_secs_f64());
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            println!("error {e}");
            ExitCode::FAILURE
        }
    }
}
