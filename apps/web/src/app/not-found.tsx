import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 - Page Not Found",
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-6xl font-extrabold text-indigo-600 mb-4">404</h1>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Page Not Found</h2>
      <p className="text-lg text-gray-600 max-w-md mx-auto mb-8">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or deleted.
      </p>
      <Link 
        href="/" 
        className="inline-flex h-12 items-center justify-center rounded-md bg-indigo-600 px-8 text-base font-medium text-white shadow transition-colors hover:bg-indigo-700"
      >
        Go Back Home
      </Link>
    </div>
  );
}
