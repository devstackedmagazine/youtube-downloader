"use client";

import { useState } from "react";
import { DownloadQuality, DownloadScope, VideoFormat, VideoMetadata } from "@/types";

interface FormatSelectorProps {
  metadata: VideoMetadata;
  onDownload: (format: VideoFormat, quality: DownloadQuality, scope: DownloadScope) => void;
  isProcessing: boolean;
}

const mp4Qualities: DownloadQuality[] = ["1440p", "1080p", "720p", "480p", "360p"];
const mp3Qualities: DownloadQuality[] = ["320kbps", "256kbps", "128kbps"];

export default function FormatSelector({ metadata, onDownload, isProcessing }: FormatSelectorProps) {
  const [format, setFormat] = useState<VideoFormat>("mp4");
  const [quality, setQuality] = useState<DownloadQuality>("1080p");
  const [scope, setScope] = useState<DownloadScope>(metadata.is_playlist ? "playlist" : "single");
  const isPlaylist = Boolean(metadata.is_playlist);
  const title = metadata.playlist_title || metadata.title;

  const changeFormat = (nextFormat: VideoFormat) => {
    setFormat(nextFormat);
    setQuality(nextFormat === "mp4" ? "1080p" : "320kbps");
  };

  return (
    <div className="surface-hover surface-hover--light overflow-hidden rounded-[2rem] border border-[#11110f]/10 bg-white shadow-[0_24px_80px_rgba(17,17,15,.08)]">
      <div className="grid md:grid-cols-[.8fr_1.2fr]">
        <div className="relative min-h-[280px] overflow-hidden bg-[#11110f] md:min-h-[360px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {metadata.thumbnail && <img src={metadata.thumbnail} alt="" className="h-full w-full object-cover opacity-85 grayscale contrast-125 transition duration-700 hover:scale-105 hover:grayscale-0" />}
          <div className="absolute inset-0 bg-gradient-to-t from-[#11110f]/90 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-[#f6f2e9]">
            <p className="mb-2 text-xs uppercase tracking-[.16em] text-[#ff6b35]">{isPlaylist ? "Playlist ready" : "Ready to shape"}</p>
            <h2 className="font-display text-3xl leading-[.95] tracking-[-.06em]">{title}</h2>
            <p className="mt-3 text-sm text-[#bdb9af]">{isPlaylist ? `${metadata.playlist_count || "Multiple"} videos` : `${metadata.channel} · ${formatDuration(metadata.duration)}`}</p>
          </div>
        </div>

        <div className="flex flex-col justify-between p-6 sm:p-8">
          <div>
            <p className="text-sm uppercase tracking-[.16em] text-[#77736a]">Choose your cut</p>
            {isPlaylist && <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-[#f0ede5] p-2" aria-label="Download selection">
              <button type="button" onClick={() => setScope("playlist")} className={`format-toggle rounded-xl px-3 py-3 text-left text-sm ${scope === "playlist" ? "is-active bg-[#11110f] text-[#f6f2e9]" : "text-[#77736a] hover:bg-[#f6f2e9]"}`}>Whole playlist<span className="mt-1 block text-xs opacity-70">One ZIP file</span></button>
              <button type="button" onClick={() => setScope("single")} className={`format-toggle rounded-xl px-3 py-3 text-left text-sm ${scope === "single" ? "is-active bg-[#11110f] text-[#f6f2e9]" : "text-[#77736a] hover:bg-[#f6f2e9]"}`}>Current video<span className="mt-1 block text-xs opacity-70">One media file</span></button>
            </div>}
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-[#f0ede5] p-2">
              {(["mp4", "mp3"] as const).map((item) => <button key={item} type="button" onClick={() => changeFormat(item)} className={`format-toggle rounded-xl px-4 py-4 text-left ${format === item ? "is-active bg-[#11110f] text-[#f6f2e9]" : "text-[#77736a] hover:bg-[#f6f2e9] hover:text-[#11110f]"}`}><span className="block font-display text-2xl tracking-[-.05em]">{item.toUpperCase()}</span><span className="mt-1 block text-xs opacity-70">{item === "mp4" ? "Video" : "Audio"}</span></button>)}
            </div>
            <label className="mt-6 block text-sm font-semibold text-[#11110f]" htmlFor="quality">Quality</label>
            <select id="quality" value={quality} onChange={(event) => setQuality(event.target.value as DownloadQuality)} className="mt-2 h-14 w-full rounded-xl border border-[#11110f]/15 bg-[#f6f2e9] px-4 font-semibold outline-none transition focus:border-[#ff6b35]">
              {(format === "mp4" ? mp4Qualities : mp3Qualities).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => onDownload(format, quality, scope)} disabled={isProcessing} className="btn-signal mt-8 inline-flex h-14 items-center justify-center rounded-full font-semibold hover:-translate-y-1 disabled:cursor-wait disabled:opacity-60">
            {isProcessing ? "Preparing your file..." : scope === "playlist" ? "Download playlist ZIP" : "Convert and download"}<span className="ml-3">↗</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}` : `${m}:${s.toString().padStart(2, "0")}`;
}
