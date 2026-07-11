import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "DLTube — Download the moment",
  description: "A fast, no-account YouTube downloader for MP4 video and MP3 audio.",
  keywords: ["youtube downloader", "youtube to mp3", "youtube to mp4", "video converter"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main className="flex min-h-screen flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
