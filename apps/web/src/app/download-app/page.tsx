import type { Metadata } from "next";
import { desktopDownloads } from "@/lib/desktop";

export const metadata: Metadata = {
  title: "DLTube for Windows and Linux — Download the app",
  description: "Free desktop app: download YouTube videos, sections and playlists as MP4 or MP3 on your own computer.",
};

const faq = [
  {
    q: "Why an app instead of the website?",
    a: "YouTube blocks downloads from cloud servers (\"Sign in to confirm you're not a bot\"). The app does all the work on your own computer, with your own internet connection, so there is no server in between to get blocked, and nothing to pay for.",
  },
  {
    q: "Is it free? Does it collect data?",
    a: "Free, no account, no ads, no analytics. The app only talks to YouTube (to download) and GitHub (to check for updates of the app and of yt-dlp).",
  },
  {
    q: "What happens when YouTube changes something?",
    a: "The app keeps its yt-dlp engine up to date by itself (once a day, verified against the official checksums). You can also press \"Update now\" in Settings.",
  },
  {
    q: "Why does Windows warn me?",
    a: "The installer isn't code-signed yet (certificates cost money). Windows SmartScreen warns about unsigned apps it hasn't seen often. The steps below get you past it; you can check the file against SHA256SUMS first.",
  },
  {
    q: "Mac?",
    a: "Not yet. Windows 10/11 and Linux for now.",
  },
];

const card = "surface-hover surface-hover--light rounded-[2rem] bg-white p-7 sm:p-9";

export default function DownloadAppPage() {
  return (
    <main className="w-full max-w-full overflow-x-hidden bg-[#f6f2e9]">
      <section className="surface-grid relative overflow-hidden bg-[#11110f] px-6 pb-24 pt-36 text-[#f6f2e9] sm:px-10 lg:px-16 lg:pt-48">
        <div className="absolute right-[-12rem] top-20 h-[34rem] w-[34rem] rounded-full bg-[#ff6b35]/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <p className="mb-8 text-sm uppercase tracking-[.2em] text-[#ff6b35]">Desktop app</p>
          <h1 className="font-display max-w-5xl text-balance text-[clamp(3.25rem,7vw,6.5rem)] leading-[.88] tracking-[-.09em]">
            DLTube, on your <span className="text-[#ff6b35]">own computer.</span>
          </h1>
          <p className="mt-9 max-w-xl text-lg leading-relaxed text-[#bdb9af]">
            Whole videos, exact sections and full playlists as MP4 or MP3. Free, no account, and it works where the website gets blocked.
          </p>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <a href={desktopDownloads.windows} className="btn-signal inline-flex h-14 items-center justify-center rounded-full px-7 font-semibold hover:-translate-y-1">Download for Windows <span className="ml-3">↓</span></a>
            <a href={desktopDownloads.appImage} className="btn-outline inline-flex h-14 items-center justify-center rounded-full border px-7 font-semibold">Linux AppImage <span className="ml-3">↓</span></a>
            <a href={desktopDownloads.deb} className="btn-outline inline-flex h-14 items-center justify-center rounded-full border px-7 font-semibold">Linux .deb <span className="ml-3">↓</span></a>
          </div>
          <p className="mt-6 text-sm text-[#8b887f]">
            About 220–280 MB download (it includes yt-dlp, FFmpeg and Deno), about 500 MB installed.{" "}
            <a href={desktopDownloads.checksums} className="underline underline-offset-4 hover:text-[#ff6b35]">SHA256SUMS</a> ·{" "}
            <a href={desktopDownloads.releases} className="underline underline-offset-4 hover:text-[#ff6b35]">All releases</a>
          </p>
        </div>
      </section>

      <section className="px-6 py-20 sm:px-10 lg:px-16">
        <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-3">
          <div className={card}>
            <h2 className="font-display text-3xl tracking-[-.06em]">System requirements</h2>
            <ul className="mt-6 space-y-2 text-sm leading-relaxed text-[#59564f]">
              <li>Windows 10 or 11, 64-bit. The installer adds Microsoft Edge WebView2 if it is missing (it ships with Windows 11).</li>
              <li>Linux x64 with glibc 2.35 or newer (Ubuntu 22.04, Debian 12, Fedora 36 and later) and WebKitGTK 4.1.</li>
              <li>About 500 MB of free disk space, plus room for your downloads.</li>
            </ul>
          </div>

          <div className={card}>
            <h2 className="font-display text-3xl tracking-[-.06em]">Windows</h2>
            <p className="mt-6 text-sm leading-relaxed text-[#59564f]">The installer isn&apos;t signed yet, so Windows may show <strong>&quot;Windows protected your PC&quot;</strong>:</p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#59564f]">
              <li>Run <code>dltube_x64-setup.exe</code>.</li>
              <li>Click <strong>More info</strong>.</li>
              <li>Click <strong>Run anyway</strong>.</li>
              <li>Follow the installer. No administrator rights needed.</li>
            </ol>
          </div>

          <div className={card}>
            <h2 className="font-display text-3xl tracking-[-.06em]">Linux</h2>
            <p className="mt-6 text-sm font-semibold">AppImage (any distribution)</p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-[#11110f] p-4 text-xs text-[#f6f2e9]">chmod +x dltube_amd64.AppImage{"\n"}./dltube_amd64.AppImage</pre>
            <p className="mt-5 text-sm font-semibold">.deb (Ubuntu, Debian, Mint)</p>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-[#11110f] p-4 text-xs text-[#f6f2e9]">sudo apt install ./dltube_amd64.deb</pre>
            <p className="mt-3 text-xs text-[#77736a]">If the AppImage doesn&apos;t start, install FUSE 2 (<code>libfuse2</code>, or <code>libfuse2t64</code> on Ubuntu 24.04).</p>
          </div>
        </div>
      </section>

      <section className="border-t border-[#11110f]/10 px-6 py-20 sm:px-10 lg:px-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-5xl leading-[.9] tracking-[-.07em]">Questions</h2>
          <div className="mt-10 space-y-3">
            {faq.map((item) => (
              <details key={item.q} className="rounded-2xl border border-[#11110f]/10 bg-white p-6">
                <summary className="cursor-pointer font-semibold">{item.q}</summary>
                <p className="mt-3 text-sm leading-relaxed text-[#59564f]">{item.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-10 text-sm text-[#77736a]">DLTube is built for personal and permitted use. Respect the original creator and the rules of the platform.</p>
        </div>
      </section>
    </main>
  );
}
