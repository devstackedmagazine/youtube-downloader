// CI smoke test of the real cut/convert path, without YouTube:
//   node scripts/smoke-cut.mjs <dltube-cli built with --features local-test> <tools-dir> <work-dir>
// Generates a 20 s test video with the bundled ffmpeg, serves it on 127.0.0.1 (yt-dlp can't cut
// sections from file:// URLs), downloads 5–12 s as MP4 and as MP3 through dltube-cli, and checks
// codecs and durations with the bundled ffprobe. <tools-dir> may hold triple-suffixed names
// (src-tauri/binaries) or plain ones (an installed app's tools/ folder).
import { execFileSync, spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";

const [cli, toolsDir, work] = process.argv.slice(2);
if (!cli || !toolsDir || !work) {
  console.error("usage: node scripts/smoke-cut.mjs <dltube-cli> <tools-dir> <work-dir>");
  process.exit(2);
}
const exe = process.platform === "win32" ? ".exe" : "";
const triple = process.platform === "win32" ? "x86_64-pc-windows-msvc" : "x86_64-unknown-linux-gnu";
const tool = (name) => [join(toolsDir, `${name}-${triple}${exe}`), join(toolsDir, `${name}${exe}`)].find(existsSync);
const ffmpeg = tool("ffmpeg");
const ffprobe = tool("ffprobe");
if (!ffmpeg || !ffprobe) throw new Error(`ffmpeg/ffprobe not found in ${toolsDir}`);

mkdirSync(work, { recursive: true });
const source = join(work, "test.mp4");
execFileSync(ffmpeg, [
  "-hide_banner", "-loglevel", "error", "-y",
  "-f", "lavfi", "-i", "testsrc=duration=20:size=1280x720:rate=30",
  "-f", "lavfi", "-i", "sine=frequency=440:duration=20",
  // faststart: the index comes first, so ffmpeg can read it from a server without Range support.
  "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-movflags", "+faststart",
  source,
]);

const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "video/mp4" });
  createReadStream(source).pipe(res);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/test.mp4`;

const probe = (file) =>
  JSON.parse(execFileSync(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_name", "-of", "json", file], { encoding: "utf8" }));

const cases = [
  { format: "mp4", quality: "720p", codecs: ["h264", "aac"] },
  { format: "mp3", quality: "128kbps", codecs: ["mp3"] },
];
let failed = false;
try {
  for (const c of cases) {
    const out = join(work, c.format);
    mkdirSync(out, { recursive: true });
    // Async exec: the server above must keep answering while dltube-cli runs.
    const status = await new Promise((resolve) => {
      spawn(cli, [toolsDir, out, "local", url, c.format, c.quality, "5", "12"], { stdio: "inherit" }).on("exit", resolve);
    });
    const files = readdirSync(out).filter((f) => f.endsWith(`.${c.format}`));
    const leftovers = readdirSync(out).filter((f) => f.startsWith(".dltube-partial"));
    if (status !== 0 || files.length !== 1) {
      console.error(`FAIL ${c.format}: exit ${status}, files ${JSON.stringify(readdirSync(out))}`);
      failed = true;
      continue;
    }
    const info = probe(join(out, files[0]));
    const duration = Number(info.format.duration);
    const codecs = info.streams.map((s) => s.codec_name);
    const ok = Math.abs(duration - 7) <= 0.25 && c.codecs.every((x) => codecs.includes(x)) && leftovers.length === 0;
    console.log(`${ok ? "OK  " : "FAIL"} ${c.format} ${c.quality}: ${files[0]} duration=${duration.toFixed(3)}s codecs=${codecs.join(",")} leftovers=${leftovers.length}`);
    failed ||= !ok;
  }
} finally {
  server.close();
}
process.exit(failed ? 1 : 0);
