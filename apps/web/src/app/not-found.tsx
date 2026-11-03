import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 - Page Not Found",
};

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#f6f2e9] px-6 pt-32 text-center">
      <p className="font-display text-8xl tracking-[-.08em] text-[#ff6b35]">404</p>
      <h1 className="mt-4 font-display text-4xl tracking-[-.06em]">Page not found</h1>
      <p className="mx-auto mt-4 max-w-md text-[#59564f]">This page doesn&apos;t exist. The DLTube app is on the home page.</p>
      <Link href="/" className="btn-ink mt-8 inline-flex h-12 items-center justify-center rounded-full px-7 font-semibold">Go home</Link>
    </div>
  );
}
