"use client";

import { useState } from "react";
import { ClipRange, DownloadQuality, DownloadScope, VideoFormat, VideoMetadata } from "@/types";
import { checkClip, formatTime } from "@/lib/time";
import SectionPicker from "@/components/SectionPicker";

interface FormatSelectorProps {
  metadata: VideoMetadata;
  onDownload: (format: VideoFormat, quality: DownloadQuality, scope: DownloadScope, clip?: ClipRange) => void;
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
  const [wantsSection, setWantsSection] = useState(false);
  const [section, setSection] = useState({ start: "", end: "" });
  // Sections need a known duration and aren't offered for playlists or live streams.
  const canSection = !isPlaylist && !metadata.is_live && metadata.duration > 0;
  const useSection = canSection && wantsSection;
  const maxDuration = metadata.max_duration_seconds;
  const clip = checkClip(section, metadata.duration, maxDuration);

  let blocker: string | null = null;
  if (metadata.is_live) blocker = "Live streams can't be downloaded. Try again after the stream has ended.";
  else if (useSection) blocker = clip.error;
  else if (!isPlaylist && maxDuration && metadata.duration > maxDuration) blocker = `This video is longer than ${formatTime(maxDuration)}. Download a section of it instead.`;

  const startDownload = () => {
    if (blocker) return;
    onDownload(format, quality, scope, useSection ? { start_time: clip.start_time, end_time: clip.end_time } : undefined);
  };

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
            <p className="mt-3 text-sm text-[#bdb9af]">{isPlaylist ? `${metadata.playlist_count || "Multiple"} videos` : `${metadata.channel} · ${formatTime(metadata.duration)}`}</p>
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
            {canSection && <>
              <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-[#f0ede5] p-2" role="group" aria-label="What to download">
                <button type="button" aria-pressed={!wantsSection} onClick={() => setWantsSection(false)} className={`format-toggle rounded-xl px-3 py-3 text-left text-sm ${!wantsSection ? "is-active bg-[#11110f] text-[#f6f2e9]" : "text-[#77736a] hover:bg-[#f6f2e9]"}`}>Whole video<span className="mt-1 block text-xs opacity-70">{formatTime(metadata.duration)}</span></button>
                <button type="button" aria-pressed={wantsSection} onClick={() => setWantsSection(true)} className={`format-toggle rounded-xl px-3 py-3 text-left text-sm ${wantsSection ? "is-active bg-[#11110f] text-[#f6f2e9]" : "text-[#77736a] hover:bg-[#f6f2e9]"}`}>Download a section<span className="mt-1 block text-xs opacity-70">Pick start and end</span></button>
              </div>
              {useSection && <SectionPicker duration={metadata.duration} value={section} onChange={setSection} result={clip} />}
            </>}
            <label className="mt-6 block text-sm font-semibold text-[#11110f]" htmlFor="quality">Quality</label>
            <select id="quality" value={quality} onChange={(event) => setQuality(event.target.value as DownloadQuality)} className="mt-2 h-14 w-full rounded-xl border border-[#11110f]/15 bg-[#f6f2e9] px-4 font-semibold outline-none transition focus:border-[#ff6b35]">
              {(format === "mp4" ? mp4Qualities : mp3Qualities).map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            {blocker && !useSection && <p className="mt-6 text-sm font-medium text-[#c33f1a]">{blocker}</p>}
            <button type="button" onClick={startDownload} disabled={isProcessing || Boolean(blocker)} className={`btn-signal mt-8 inline-flex h-14 w-full items-center justify-center rounded-full font-semibold hover:-translate-y-1 disabled:opacity-60 ${isProcessing ? "disabled:cursor-wait" : "disabled:cursor-not-allowed"}`}>
              {isProcessing ? "Preparing your file..." : scope === "playlist" ? "Download playlist ZIP" : useSection ? "Convert and download section" : "Convert and download"}<span className="ml-3">↗</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

