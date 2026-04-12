import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Free YouTube Video Downloader - Download Videos as MP4 or MP3",
  description: "Download YouTube videos instantly as MP4 or MP3. No watermarks, no limits, 100% free.",
  keywords: ["youtube video downloader", "download youtube videos", "youtube to mp3", "youtube to mp4", "youtube downloader"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-white text-gray-900 flex flex-col`}>
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
