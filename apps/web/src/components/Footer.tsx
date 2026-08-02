import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#11110f] px-6 py-12 text-[#f6f2e9] sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-12 border-b border-white/10 pb-12 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <Link href="/" className="flex items-center gap-3">
              <span className="brand-mark brand-mark-light" aria-hidden="true"><span /></span>
              <span className="font-display text-lg tracking-[-0.04em]">DLTube</span>
            </Link>
            <p className="mt-8 font-display text-4xl leading-[0.96] tracking-[-0.06em] text-[#f6f2e9] sm:text-5xl">
              Make the internet<br />a little more yours.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-[#8b887f]">
            <Link href="/download" className="footer-link">Download</Link>
            <Link href="/#capabilities" className="footer-link">Capabilities</Link>
            <a href="mailto:hello@dltube.local" className="footer-link">Contact</a>
            <span>Use responsibly</span>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-4 pt-5 text-xs text-[#68665f] sm:flex-row">
          <p>© {new Date().getFullYear()} DLTube. No account. No clutter.</p>
          <p>For personal and permitted use only.</p>
        </div>
      </div>
    </footer>
  );
}
