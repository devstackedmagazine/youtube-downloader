import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "DLTube — YouTube to MP4 and MP3, on your own computer",
  description: "Free desktop app for Windows and Linux: download YouTube videos, exact sections and playlists as MP4 or MP3. No account.",
  keywords: ["youtube downloader", "youtube to mp3", "youtube to mp4", "desktop app", "windows", "linux"],
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
