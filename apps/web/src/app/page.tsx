import Link from "next/link";
import MotionShowcase from "@/components/MotionShowcase";

const capabilities = [
  { title: "MP4 video", detail: "1440p to 360p", tone: "bg-[#d9e7df]" },
  { title: "MP3 audio", detail: "320kbps to 128kbps", tone: "bg-[#f2d2c2]" },
  { title: "No account", detail: "Open, paste, done.", tone: "bg-[#ded8ed]" },
];

export default function Home() {
  return (
    <main className="w-full max-w-full overflow-x-hidden bg-[#f6f2e9]">
      <section className="grain relative isolate min-h-[820px] overflow-hidden bg-[#11110f] px-6 pb-20 pt-36 text-[#f6f2e9] sm:px-10 lg:min-h-[900px] lg:px-16 lg:pt-48">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_35%,rgba(255,107,53,.38),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(120,151,190,.24),transparent_32%)]" />
        <div className="hero-orb absolute -right-24 top-44 -z-10 h-80 w-80 rounded-full border border-[#ff6b35]/30 bg-[#ff6b35]/10 blur-[1px] lg:h-[34rem] lg:w-[34rem]" />
        <div className="mx-auto grid max-w-7xl items-end gap-16 lg:grid-cols-[1fr_340px]">
          <div>
            <p className="mb-8 max-w-sm text-sm leading-relaxed text-[#bdb9af]">A cleaner way to keep the moments you find online.</p>
            <h1 className="font-display max-w-6xl text-balance text-[clamp(3rem,6vw,6.75rem)] leading-[.9] tracking-[-.08em]">
              Take the good stuff <span className="inline-block h-[.58em] w-[1.4em] align-[.03em] rounded-full bg-[url('https://picsum.photos/seed/analog-film/800/500')] bg-cover bg-center grayscale transition duration-700 hover:grayscale-0" aria-label="Analog film texture" /> with you.
            </h1>
            <p className="mt-10 max-w-xl text-lg leading-relaxed text-[#bdb9af] sm:text-xl">DLTube turns a YouTube link into a crisp MP4 or clean MP3 in a few clicks. No software. No account. Just the file.</p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href="/download" className="btn-signal inline-flex h-14 items-center justify-center rounded-full px-7 font-semibold hover:-translate-y-1">Paste a link <span className="ml-3 text-lg">↗</span></Link>
              <Link href="#capabilities" className="btn-outline inline-flex h-14 items-center justify-center rounded-full border px-7 font-semibold">See what it does</Link>
            </div>
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
              <div className="relative flex h-full flex-col justify-between"><div><p className="max-w-sm text-sm leading-relaxed text-[#bdb9af]">One link can become a watchable file, a listening file, or both. Choose the shape that fits the moment.</p><h3 className="mt-20 font-display text-6xl leading-[.9] tracking-[-.07em] sm:text-8xl">Your format.<br /><span className="text-[#ff6b35]">Your rules.</span></h3></div><div className="flex items-end justify-between"><span className="font-display text-5xl tracking-[-.07em]">04K</span><span className="max-w-[11rem] text-right text-sm text-[#bdb9af]">Sharp enough for the big screen. Light enough for the commute.</span></div></div>
            </div>
            {capabilities.slice(0, 2).map((item) => <div key={item.title} className={`surface-hover group relative col-span-12 min-h-[204px] overflow-hidden rounded-[2rem] p-7 sm:col-span-4 ${item.tone}`}><div className="flex h-full flex-col justify-between"><span className="font-display text-4xl tracking-[-.06em]">{item.title}</span><div className="flex items-end justify-between"><span className="text-sm text-[#59564f]">{item.detail}</span><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#11110f] text-[#f6f2e9] transition duration-300 group-hover:rotate-45">↗</span></div></div></div>)}
          </div>
          <div className="marquee-viewport mt-3 rounded-full bg-[#11110f] py-4 text-[#f6f2e9]"><div className="marquee-track font-display text-xl tracking-[-.03em]"><div className="marquee-group"><span>Paste. Pick. Keep.</span><span className="text-[#ff6b35]">✳</span><span>MP4 / MP3</span><span className="text-[#ff6b35]">✳</span><span>No account required</span><span className="text-[#ff6b35]">✳</span></div><div aria-hidden="true" className="marquee-group"><span>Paste. Pick. Keep.</span><span className="text-[#ff6b35]">✳</span><span>MP4 / MP3</span><span className="text-[#ff6b35]">✳</span><span>No account required</span><span className="text-[#ff6b35]">✳</span></div></div></div>
        </div>
      </section>

      <MotionShowcase />

      <section id="how-it-works" className="surface-grid relative overflow-hidden bg-[#d9e7df] px-6 py-32 sm:px-10 md:py-48 lg:px-16">
        <div className="relative mx-auto grid max-w-7xl gap-16 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="mb-6 text-sm font-semibold uppercase tracking-[.2em] text-[#4b6a59]">A shorter route</p><h2 className="font-display max-w-xl text-6xl leading-[.9] tracking-[-.08em] sm:text-8xl">From link to file in three moves.</h2></div><div className="grid gap-3 sm:grid-cols-3">{[{ n: "01", t: "Copy", d: "Grab a YouTube URL." }, { n: "02", t: "Choose", d: "Pick video or audio." }, { n: "03", t: "Keep", d: "Download your file." }].map((step) => <div key={step.n} className="surface-hover surface-hover--light group min-h-56 rounded-[1.5rem] border border-[#11110f]/15 bg-[#f6f2e9]/55 p-6 transition duration-500 hover:bg-[#f6f2e9]"><span className="font-display text-3xl text-[#4b6a59]">{step.n}</span><h3 className="mt-16 font-display text-3xl tracking-[-.05em]">{step.t}</h3><p className="mt-2 text-sm leading-relaxed text-[#59564f]">{step.d}</p></div>)}</div></div>
      </section>

      <section id="ethos" className="bg-[#ff6b35] px-6 py-32 sm:px-10 md:py-48 lg:px-16"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-14 lg:flex-row lg:items-end"><div><p className="mb-6 text-sm font-semibold uppercase tracking-[.2em] text-[#11110f]/60">The good kind of simple</p><h2 className="font-display max-w-4xl text-balance text-6xl leading-[.88] tracking-[-.08em] sm:text-8xl">The download button you wish every site had.</h2></div><div className="max-w-xs"><p className="text-base leading-relaxed text-[#11110f]/75">Built for personal, permitted use. Keep the videos, mixes, and references that matter to you close by.</p><Link href="/download" className="btn-ink mt-8 inline-flex h-14 items-center justify-center rounded-full px-7 font-semibold hover:-translate-y-1">Download something <span className="ml-3">↗</span></Link></div></div></section>
    </main>
  );
}
