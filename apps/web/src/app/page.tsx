import MotionShowcase from "@/components/MotionShowcase";
import { desktopDownloads, getReleaseStatus, type ReleaseStatus } from "@/lib/desktop";

const capabilities = [
  { title: "MP4 video", detail: "Up to 1080p in H.264, plays anywhere. Or best quality.", tone: "bg-[#d9e7df]" },
  { title: "MP3 audio", detail: "320kbps to 128kbps", tone: "bg-[#f2d2c2]" },
];

const faq = [
  {
    q: "Why an app and not a website?",
    a: "YouTube blocks downloads from cloud servers (\"Sign in to confirm you're not a bot\"). The app does all the work on your own computer, with your own internet connection, so there is no server in between to get blocked, and nothing to pay for.",
  },
  {
    q: "Is it free? Does it collect data?",
    a: "Free and open source (MIT), no account, no ads, no analytics. The app only talks to YouTube (to download) and GitHub (to check for updates of the app and of yt-dlp).",
  },
  {
    q: "Will the videos play on my computer?",
    a: "Yes. MP4s are H.264 + AAC by default, which every player understands, including the one built into Windows. Pick \"Best quality\" for the highest resolution YouTube has; that is often AV1 or VP9, which older players may not play.",
  },
  {
    q: "What happens when YouTube changes something?",
    a: "The app keeps its yt-dlp engine up to date by itself (once a day, verified against the official checksums). You can also press \"Update now\" in Settings.",
  },
  {
    q: "Why does Windows warn me?",
    a: "The installer isn't code-signed yet. Windows SmartScreen warns about unsigned apps it hasn't seen often. The steps above get you past it; you can check the file against SHA256SUMS first.",
  },
  {
    q: "Mac?",
    a: "Not yet. Windows 10/11 and Linux for now.",
  },
];

const card = "surface-hover surface-hover--light rounded-[2rem] bg-white p-7 sm:p-9";

function DownloadButtons({ release, tone }: { release: ReleaseStatus; tone: "dark" | "light" }) {
  // The light variant sits on the orange section, where the orange button would vanish.
  const primary = tone === "dark" ? "btn-signal" : "btn-ink";
  const secondary = tone === "dark" ? "btn-outline border" : "btn-paper";
  if (release.state !== "available") {
    return (
      <div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <a href={desktopDownloads.releases} className={`${primary} inline-flex h-14 items-center justify-center rounded-full px-7 font-semibold hover:-translate-y-1`}>
            {release.state === "none" ? "Coming soon" : "Download from GitHub"} <span className="ml-3">↗</span>
          </a>
        </div>
        <p className={`mt-4 text-sm ${tone === "dark" ? "text-[#8b887f]" : "text-[#11110f]/70"}`}>
          {release.state === "none"
            ? "The first release for Windows and Linux is almost ready. It will appear on the GitHub releases page."
            : "Windows and Linux installers are on the GitHub releases page."}
        </p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a href={desktopDownloads.windows} className={`${primary} inline-flex h-14 items-center justify-center rounded-full px-7 font-semibold hover:-translate-y-1`}>Download for Windows <span className="ml-3">↓</span></a>
        <a href={desktopDownloads.appImage} className={`${secondary} inline-flex h-14 items-center justify-center rounded-full px-7 font-semibold`}>Linux AppImage <span className="ml-3">↓</span></a>
        <a href={desktopDownloads.deb} className={`${secondary} inline-flex h-14 items-center justify-center rounded-full px-7 font-semibold`}>Linux .deb <span className="ml-3">↓</span></a>
      </div>
      <p className={`mt-4 text-sm ${tone === "dark" ? "text-[#8b887f]" : "text-[#11110f]/70"}`}>
        Version {release.version} · <a href={desktopDownloads.checksums} className="underline underline-offset-4 hover:text-[#ff6b35]">SHA256SUMS</a> · <a href={desktopDownloads.releases} className="underline underline-offset-4 hover:text-[#ff6b35]">All releases</a>
      </p>
    </div>
  );
}

export default async function Home() {
  const release = await getReleaseStatus();

  return (
    <main className="w-full max-w-full overflow-x-hidden bg-[#f6f2e9]">
      <section className="grain relative isolate min-h-[820px] overflow-hidden bg-[#11110f] px-6 pb-20 pt-36 text-[#f6f2e9] sm:px-10 lg:min-h-[900px] lg:px-16 lg:pt-48">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_35%,rgba(255,107,53,.38),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(120,151,190,.24),transparent_32%)]" />
        <div className="hero-orb absolute -right-24 top-44 -z-10 h-80 w-80 rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 blur-[1px] lg:h-[34rem] lg:w-[34rem]" />
        <div className="mx-auto grid max-w-7xl items-end gap-16 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="mb-8 max-w-sm text-sm leading-relaxed text-[#bdb9af]">Free desktop app for Windows and Linux.</p>
            <h1 className="font-display max-w-6xl text-balance text-[clamp(3rem,6vw,6.75rem)] leading-[.9] tracking-[-.08em]">
              Take the good stuff <span className="inline-block h-[.58em] w-[1.4em] align-[.03em] rounded-full bg-[url('https://picsum.photos/seed/analog-film/800/500')] bg-cover bg-center grayscale transition duration-700 hover:grayscale-0" aria-label="Analog film texture" /> with you.
            </h1>
            <p className="mt-10 max-w-xl text-lg leading-relaxed text-[#bdb9af] sm:text-xl">DLTube turns a YouTube link into a crisp MP4 or clean MP3, right on your own computer. Whole videos, exact sections, full playlists. No account.</p>
            <div className="mt-10"><DownloadButtons release={release} tone="dark" /></div>
          </div>
          <div className="relative hidden h-80 lg:block">
            <div className="surface-hover surface-hover--dark absolute right-0 top-0 w-64 rotate-6 overflow-hidden rounded-[2rem] border border-white/20 bg-[#2c2b27] p-3 shadow-2xl shadow-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://picsum.photos/seed/night-drive/640/860" alt="Night drive still" className="h-64 w-full rounded-[1.35rem] object-cover grayscale contrast-125 transition duration-700 hover:scale-105 hover:grayscale-0" />
              <p className="px-2 pb-2 pt-3 font-display text-sm text-[#d8d3c8]">Keep the atmosphere.</p>
            </div>
            <div className="cursor-ring absolute bottom-4 left-0 flex h-28 w-28 -rotate-12 items-center justify-center rounded-full bg-[#f6f2e9] text-center text-xs font-bold uppercase tracking-[.16em] text-[#11110f]">play<br />back<br />later</div>
          </div>
        </div>
        <div className="mx-auto mt-20 flex max-w-7xl items-center justify-between border-t border-white/15 pt-5 text-xs uppercase tracking-[.18em] text-[#8b887f]"><span>Video / audio / yours</span><span>Scroll to explore</span></div>
      </section>

      <section id="capabilities" className="px-6 py-32 sm:px-10 md:py-48 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-2xl"><p className="mb-6 text-sm font-semibold uppercase tracking-[.2em] text-[#ff6b35]">Made for the handoff</p><h2 className="font-display text-balance text-5xl leading-[.94] tracking-[-.07em] sm:text-7xl">Everything you need. Nothing that gets in the way.</h2></div>
          <div className="grid grid-flow-dense grid-cols-12 grid-rows-2 gap-3">
            <div className="surface-hover surface-hover--dark group relative col-span-12 min-h-[420px] overflow-hidden rounded-[2rem] bg-[#11110f] p-7 text-[#f6f2e9] sm:col-span-8 sm:row-span-2 sm:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,rgba(255,107,53,.35),transparent_35%),linear-gradient(135deg,#11110f,#2a2925)]" />
              <div className="relative flex h-full flex-col justify-between"><div><p className="max-w-sm text-sm leading-relaxed text-[#bdb9af]">Only need the chorus, the goal or the one quote? Type a start and an end, like 1:05 to 1:42, and get just that part. Cut on the exact second, as MP4 or MP3.</p><h3 className="mt-20 font-display text-6xl leading-[.9] tracking-[-.07em] sm:text-8xl">Just the part<br /><span className="text-[#ff6b35]">you want.</span></h3></div><div className="flex items-end justify-between"><span className="font-display text-5xl tracking-[-.07em]">1:05–1:42</span><span className="max-w-[11rem] text-right text-sm text-[#bdb9af]">Sections, whole videos or entire playlists.</span></div></div>
            </div>
            {capabilities.map((item) => <div key={item.title} className={`surface-hover group relative col-span-12 min-h-[204px] overflow-hidden rounded-[2rem] p-7 sm:col-span-4 ${item.tone}`}><div className="flex h-full flex-col justify-between"><span className="font-display text-4xl tracking-[-.06em]">{item.title}</span><div className="flex items-end justify-between gap-4"><span className="text-sm text-[#59564f]">{item.detail}</span><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#11110f] text-[#f6f2e9] transition duration-300 group-hover:rotate-45">↗</span></div></div></div>)}
          </div>
          <div className="marquee-viewport mt-3 rounded-full bg-[#11110f] py-4 text-[#f6f2e9]"><div className="marquee-track font-display text-xl tracking-[-.03em]"><div className="marquee-group"><span>Paste. Pick. Keep.</span><span className="text-[#ff6b35]">✳</span><span>MP4 / MP3</span><span className="text-[#ff6b35]">✳</span><span>No account required</span><span className="text-[#ff6b35]">✳</span></div><div aria-hidden="true" className="marquee-group"><span>Paste. Pick. Keep.</span><span className="text-[#ff6b35]">✳</span><span>MP4 / MP3</span><span className="text-[#ff6b35]">✳</span><span>No account required</span><span className="text-[#ff6b35]">✳</span></div></div></div>
        </div>
      </section>

      <MotionShowcase />

      <section id="how-it-works" className="surface-grid relative overflow-hidden bg-[#d9e7df] px-6 py-32 sm:px-10 md:py-48 lg:px-16">
        <div className="relative mx-auto grid max-w-7xl gap-16 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="mb-6 text-sm font-semibold uppercase tracking-[.2em] text-[#4b6a59]">A shorter route</p><h2 className="font-display max-w-xl text-6xl leading-[.9] tracking-[-.08em] sm:text-8xl">From link to file in three moves.</h2></div><div className="grid gap-3 sm:grid-cols-3">{[{ n: "01", t: "Copy", d: "Grab a YouTube URL and paste it into DLTube." }, { n: "02", t: "Choose", d: "Video or audio, whole or just a section." }, { n: "03", t: "Keep", d: "The file lands in your Downloads folder." }].map((step) => <div key={step.n} className="surface-hover surface-hover--light group min-h-56 rounded-[1.5rem] border border-[#11110f]/15 bg-[#f6f2e9]/55 p-6 transition duration-500 hover:bg-[#f6f2e9]"><span className="font-display text-3xl text-[#4b6a59]">{step.n}</span><h3 className="mt-16 font-display text-3xl tracking-[-.05em]">{step.t}</h3><p className="mt-2 text-sm leading-relaxed text-[#59564f]">{step.d}</p></div>)}</div></div>
      </section>

      <section id="download" className="scroll-mt-24 px-6 py-32 sm:px-10 md:py-40 lg:px-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-3xl">
            <p className="mb-6 text-sm font-semibold uppercase tracking-[.2em] text-[#ff6b35]">Get the app</p>
            <h2 className="font-display text-balance text-5xl leading-[.94] tracking-[-.07em] sm:text-7xl">Install once. Download forever.</h2>
            <p className="mt-6 text-base leading-relaxed text-[#59564f]">
              Download size: about 145 MB for Windows, 220–275 MB for Linux (it includes yt-dlp, FFmpeg and Deno). About 500 MB installed.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className={card}>
              <h3 className="font-display text-3xl tracking-[-.06em]">System requirements</h3>
              <ul className="mt-6 space-y-2 text-sm leading-relaxed text-[#59564f]">
                <li>Windows 10 or 11, 64-bit. The installer adds Microsoft Edge WebView2 if it is missing (it ships with Windows 11).</li>
                <li>Linux x64 with glibc 2.35 or newer (Ubuntu 22.04, Debian 12, Fedora 36 and later) and WebKitGTK 4.1.</li>
                <li>About 500 MB of free disk space, plus room for your downloads.</li>
              </ul>
            </div>

            <div className={card}>
              <h3 className="font-display text-3xl tracking-[-.06em]">Windows</h3>
              <p className="mt-6 text-sm leading-relaxed text-[#59564f]">The installer isn&apos;t signed yet, so Windows may show <strong>&quot;Windows protected your PC&quot;</strong>:</p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[#59564f]">
                <li>Run <code>dltube_x64-setup.exe</code>.</li>
                <li>Click <strong>More info</strong>.</li>
                <li>Click <strong>Run anyway</strong>.</li>
                <li>Follow the installer. No administrator rights needed.</li>
              </ol>
            </div>

            <div className={card}>
              <h3 className="font-display text-3xl tracking-[-.06em]">Linux</h3>
              <p className="mt-6 text-sm font-semibold">AppImage (any distribution)</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-[#11110f] p-4 text-xs text-[#f6f2e9]">chmod +x dltube_amd64.AppImage{"\n"}./dltube_amd64.AppImage</pre>
              <p className="mt-5 text-sm font-semibold">.deb (Ubuntu, Debian, Mint)</p>
              <pre className="mt-2 overflow-x-auto rounded-xl bg-[#11110f] p-4 text-xs text-[#f6f2e9]">sudo apt install ./dltube_amd64.deb</pre>
              <p className="mt-3 text-xs text-[#77736a]">If the AppImage doesn&apos;t start, install FUSE 2 (<code>libfuse2</code>, or <code>libfuse2t64</code> on Ubuntu 24.04).</p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 border-t border-[#11110f]/10 px-6 py-24 sm:px-10 lg:px-16">
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
        </div>
      </section>

      <section id="ethos" className="bg-[#ff6b35] px-6 py-32 sm:px-10 md:py-48 lg:px-16"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-14 lg:flex-row lg:items-end"><div><p className="mb-6 text-sm font-semibold uppercase tracking-[.2em] text-[#11110f]/60">The good kind of simple</p><h2 className="font-display max-w-4xl text-balance text-6xl leading-[.88] tracking-[-.08em] sm:text-8xl">The download button you wish every site had.</h2></div><div className="max-w-md"><p className="mb-8 text-base leading-relaxed text-[#11110f]/75">Built for personal, permitted use. Respect the original creator and the rules of the platform.</p><DownloadButtons release={release} tone="light" /></div></div></section>
    </main>
  );
}
