"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const { currentUser, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
          </svg>
          DLTube
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/#features" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">Features</Link>
          <Link href="/download" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">Download</Link>
          
          {currentUser ? (
            <>
              <Link href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">Dashboard</Link>
              <button onClick={logout} className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">Log Out</button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm font-medium text-gray-700 hover:text-indigo-600 transition-colors">Log In</Link>
              <Link href="/auth/signup" className="inline-flex h-9 items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow transition-colors hover:bg-indigo-700">Sign Up</Link>
            </>
          )}
        </nav>
        <div className="md:hidden">
          <Link href="/download" className="text-sm font-medium text-indigo-600">Download</Link>
        </div>
      </div>
    </header>
  );
}
