"use client";

import { useAuth } from "./auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || isLoading) return;

    if (!currentUser) {
      if (!pathname.startsWith("/auth/")) {
        router.push("/auth/login");
      }
    } else {
      if (pathname.startsWith("/auth/")) {
        router.push("/dashboard");
      }
    }
  }, [currentUser, isLoading, router, pathname, mounted]);

  if (!mounted || isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center min-h-[50vh]">
        <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  // If unauthenticated and on a protected route, or vice versa, don't render children while redirecting.
  if (!currentUser && !pathname.startsWith("/auth/")) return null;
  if (currentUser && pathname.startsWith("/auth/")) return null;

  return <>{children}</>;
}
