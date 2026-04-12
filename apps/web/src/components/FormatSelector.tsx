"use client";

import { VideoMetadata, VideoFormat, DownloadQuality } from "@/types";
import { useState } from "react";

interface FormatSelectorProps {
  metadata: VideoMetadata;
  onDownload: (format: VideoFormat, quality: DownloadQuality) => void;
  isProcessing: boolean;
}

export default function FormatSelector({ metadata, onDownload, isProcessing }: FormatSelectorProps) {
  const [format, setFormat] = useState<VideoFormat>("mp4");
  const [quality, setQuality] = useState<DownloadQuality>("1080p");

  const mp4Qualities: DownloadQuality[] = ["1440p", "1080p", "720p", "480p", "360p"];
  const mp3Qualities: DownloadQuality[] = ["320kbps", "256kbps", "128kbps"];

  const handleFormatChange = (newFormat: VideoFormat) => {
    setFormat(newFormat);
    setQuality(newFormat === "mp4" ? "1080p" : "320kbps");
  };

  const handleDownload = () => {
    onDownload(format, quality);
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 mt-8">
      <div className="flex flex-col md:flex-row gap-6 mb-8 pb-8 border-b border-gray-100">
        <div className="w-full md:w-1/3 aspect-video bg-gray-100 rounded-lg overflow-hidden relative shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={metadata.thumbnail} alt={metadata.title} className="object-cover w-full h-full" />
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded">
            {formatDuration(metadata.duration)}
          </div>
        </div>
        <div className="w-full md:w-2/3 flex flex-col justify-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2" title={metadata.title}>
            {metadata.title}
          </h2>
          <p className="text-gray-500 font-medium">Channel: {metadata.channel}</p>
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4 items-end">
        <div className="w-full md:w-1/3 flex flex-col gap-2 relative">
          <label className="font-semibold text-gray-700">Format</label>
          <div className="flex bg-gray-100 p-1 rounded-md">
            <button
              onClick={() => handleFormatChange("mp4")}
              className={`flex-1 py-2 text-sm font-bold rounded shadow-sm transition-colors ${
                format === "mp4" ? "bg-white text-indigo-600" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              MP4 Video
            </button>
            <button
              onClick={() => handleFormatChange("mp3")}
              className={`flex-1 py-2 text-sm font-bold rounded shadow-sm transition-colors ${
                format === "mp3" ? "bg-white text-indigo-600" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              MP3 Audio
            </button>
          </div>
        </div>
        <div className="w-full md:w-1/3 flex flex-col gap-2">
          <label className="font-semibold text-gray-700">Quality</label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value as DownloadQuality)}
            className="w-full py-2.5 px-4 bg-white border border-gray-300 font-medium text-gray-900 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          >
            {(format === "mp4" ? mp4Qualities : mp3Qualities).map((q) => (
              <option key={q} value={q}>{q}</option>
            ))}
          </select>
        </div>
        <div className="w-full md:w-1/3 flex flex-col">
          <button
            onClick={handleDownload}
            disabled={isProcessing}
            className="w-full h-11 bg-indigo-600 text-white font-bold rounded-md shadow hover:bg-indigo-700 transition disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isProcessing ? "Processing..." : "Convert & Download"}
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
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
