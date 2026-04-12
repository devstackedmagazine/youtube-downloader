import { VideoMetadata, DownloadQuality, VideoFormat, DownloadJob } from "@/types";

export const MOCK_VIDEOS: Record<string, VideoMetadata> = {
  "dQw4w9WgXcQ": {
    id: "dQw4w9WgXcQ",
    title: "Never Gonna Give You Up - Rick Astley (Official Music Video)",
    duration: 213,
    thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    channel: "Rick Astley",
    formats: []
  },
  "jNQXAC9IVRw": {
    id: "jNQXAC9IVRw",
    title: "Me at the zoo",
    duration: 18,
    thumbnail: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
    channel: "jawed",
    formats: []
  },
  "lpi-gO2neTs": {
    id: "lpi-gO2neTs",
    title: "First 8K Video on YouTube",
    duration: 140,
    thumbnail: "https://i.ytimg.com/vi/lpi-gO2neTs/hqdefault.jpg",
    channel: "Neumannfilms",
    formats: []
  }
};

export const MOCK_DOWNLOAD_HISTORY = Array.from({ length: 45 }).map((_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * 30));
  
  const formats: VideoFormat[] = ["mp4", "mp3"];
  const format = formats[Math.floor(Math.random() * formats.length)];
  
  const qualities = format === "mp4" ? ["1080p", "720p", "480p"] : ["320kbps", "128kbps"];
  const quality = qualities[Math.floor(Math.random() * qualities.length)];

  return {
    id: `dl_${i}`,
    title: `Sample Video Title ${i + 1}`,
    format,
    quality,
    date: date.toISOString(),
  };
}).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
