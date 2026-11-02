#!/usr/bin/env node
// Downloads the pinned yt-dlp, ffmpeg/ffprobe and Deno builds listed in ../sidecars.json,
// verifies their SHA-256 and stores them under src-tauri/binaries/ with the target-triple
// suffix Tauri's externalBin expects (e.g. yt-dlp-x86_64-pc-windows-msvc.exe).
//
// Usage: node scripts/fetch-sidecars.mjs [--target <triple>] [--force]
// Uses only Node built-ins plus the system `tar` (and `unzip` on Linux/macOS) for extraction.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { chmod, copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "src-tauri", "binaries");
const manifestPath = join(root, "sidecars.json");

const HOST_TARGETS = { "linux-x64": "x86_64-unknown-linux-gnu", "win32-x64": "x86_64-pc-windows-msvc" };

function parseArgs(argv) {
  const args = { target: HOST_TARGETS[`${process.platform}-${process.arch}`], force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target") args.target = argv[++i];
    else if (argv[i] === "--force") args.force = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.target) throw new Error(`No pinned builds for ${process.platform}-${process.arch}; pass --target.`);
  return args;
}

export async function sha256File(path) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

async function download(url, dest) {
  if (!url.startsWith("https://")) throw new Error(`Refusing non-HTTPS URL: ${url}`);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) throw new Error(`GET ${url} failed: HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
}

async function findFile(dir, name) {
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (entry.isFile() && entry.name === name) return join(entry.parentPath ?? entry.path, entry.name);
  }
  throw new Error(`${name} not found in the extracted archive`);
}

function extract(archive, dir) {
  if (archive.endsWith(".zip") && process.platform !== "win32") execFileSync("unzip", ["-q", archive, "-d", dir]);
  else execFileSync("tar", ["-xf", archive, "-C", dir]); // Windows' bsdtar also reads .zip
}

async function main() {
  const { target, force } = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const exe = target.includes("windows") ? ".exe" : "";
  const stampPath = join(outDir, `.stamp-${target}`);
  const stamp = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  if (!force && existsSync(stampPath) && (await readFile(stampPath, "utf8")) === stamp) {
    console.log(`Sidecars for ${target} are up to date.`);
    return;
  }

  await mkdir(outDir, { recursive: true });
  const work = await mkdtemp(join(tmpdir(), "dltube-sidecars-"));
  try {
    for (const [tool, spec] of Object.entries(manifest).filter(([key]) => !key.startsWith("_"))) {
      const pin = spec[target];
      if (!pin) throw new Error(`${tool} has no pinned build for ${target}`);
      const fileName = pin.url.split("/").pop();
      const downloaded = join(work, fileName);
      console.log(`Downloading ${tool} ${spec.version} ...`);
      await download(pin.url, downloaded);
      const actual = await sha256File(downloaded);
      if (actual !== pin.sha256) throw new Error(`Checksum mismatch for ${fileName}: expected ${pin.sha256}, got ${actual}`);

      const binaries = spec.binaries ?? [tool];
      let sources;
      if (/\.(zip|tar\.xz)$/.test(fileName)) {
        const extracted = await mkdtemp(join(work, `${tool}-`));
        extract(downloaded, extracted);
        sources = await Promise.all(binaries.map((name) => findFile(extracted, name + exe)));
      } else {
        sources = [downloaded];
      }
      for (const [index, name] of binaries.entries()) {
        const dest = join(outDir, `${name}-${target}${exe}`);
        await copyFile(sources[index], dest);
        await chmod(dest, 0o755);
        console.log(`  -> ${name}-${target}${exe}`);
      }
    }
    await writeFile(stampPath, stamp);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
