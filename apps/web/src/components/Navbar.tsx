import Link from "next/link";

export default function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full border border-white/10 bg-[#11110f]/85 px-5 text-[#f6f2e9] shadow-2xl shadow-black/10 backdrop-blur-xl sm:px-7">
        <Link href="/" className="group flex items-center gap-3" aria-label="DLTube home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="font-display text-lg tracking-[-0.04em]">DLTube</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm text-[#bdb9af] md:flex">
          <Link href="/#capabilities" className="nav-link">Capabilities</Link>
          <Link href="/#how-it-works" className="nav-link">How it works</Link>
          <Link href="/#ethos" className="nav-link">Built differently</Link>
        </nav>

        <Link href="/download" className="btn-paper inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold hover:-translate-y-0.5">
          Start a download
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      </div>
    </header>
  );
}
