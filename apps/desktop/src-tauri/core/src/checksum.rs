//! SHA-256 helpers for verifying downloaded yt-dlp builds.
use sha2::{Digest, Sha256};
use std::{fs::File, io, path::Path};

pub fn sha256_hex(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}

pub fn sha256_file(path: &Path) -> io::Result<String> {
    let mut hasher = Sha256::new();
    io::copy(&mut File::open(path)?, &mut hasher)?;
    Ok(hex(&hasher.finalize()))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Find `file_name`'s hash in a `sha256sum`-style file ("<hash>  <name>" or "<hash> *<name>").
pub fn find_in_sums(sums: &str, file_name: &str) -> Option<String> {
    sums.lines().find_map(|line| {
        let (hash, name) = line.trim().split_once(char::is_whitespace)?;
        let name = name.trim_start().trim_start_matches('*');
        (name == file_name && hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()))
            .then(|| hash.to_ascii_lowercase())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const SUMS: &str = "\
0d7ec4303a02bcbe66154d478852cdf2e07688d39dc4597316e4424ac4e74356  yt-dlp.tar.gz
767BA9DCE7052AA196F8B12652F433D76DE128BA168966FA84B6394D5E6C6795  yt-dlp_linux
f5389d3698ecde4ef06f4e6b1ce0294fe9ac1396228c8990b8d3416d6d177a7d *yt-dlp.exe
nothex  yt-dlp_macos
";

    #[test]
    fn finds_hashes() {
        assert_eq!(
            find_in_sums(SUMS, "yt-dlp_linux").as_deref(),
            Some("767ba9dce7052aa196f8b12652f433d76de128ba168966fa84b6394d5e6c6795")
        );
        assert!(find_in_sums(SUMS, "yt-dlp.exe").unwrap().starts_with("f5389d36"));
        assert_eq!(find_in_sums(SUMS, "yt-dlp_linux_aarch64"), None);
        assert_eq!(find_in_sums(SUMS, "yt-dlp_macos"), None);
    }

    #[test]
    fn hashes_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("f");
        std::fs::write(&path, "abc").unwrap();
        let expected = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
        assert_eq!(sha256_file(&path).unwrap(), expected);
        assert_eq!(sha256_hex(b"abc"), expected);
    }
}
