"use client";

import { useState } from "react";
import { DownloadStatus, VideoMetadata, VideoFormat, DownloadQuality, DownloadJob } from "@/types";
import URLInput from "@/components/URLInput";
import FormatSelector from "@/components/FormatSelector";
import DownloadProgress from "@/components/DownloadProgress";

export default function DownloadPage() {
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [job, setJob] = useState<DownloadJob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleURLSubmit = async (url: string) => {
    setStatus("fetching");
    setErrorMessage("");
    
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const mockData: VideoMetadata = {
        id: "dQw4w9WgXcQ",
        title: "Never Gonna Give You Up - Rick Astley (Official Music Video)",
        duration: 213,
        thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        channel: "Rick Astley",
        formats: []
      };
      
      setMetadata(mockData);
      setStatus("ready");
    } catch (e: any) {
      setStatus("failed");
      setErrorMessage("Failed to fetch video. Please check the URL and try again.");
    }
  };

  const handleDownloadStart = async (format: VideoFormat, quality: DownloadQuality) => {
    if (!metadata) return;
    setStatus("processing");
    const mockJob: DownloadJob = {
      id: "job_12345",
      status: "processing",
      progress: 0,
      eta: "Calculating..."
    };
    
    setJob(mockJob);
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 15) + 5;
      if (currentProgress >= 100) {
        clearInterval(interval);
        setStatus("completed");
        setJob(prev => prev ? {
          ...prev,
          status: "completed",
          progress: 100,
          eta: "0s",
          download_link: "#"
        } : null);
      } else {
        setJob(prev => prev ? {
          ...prev,
          progress: currentProgress,
          eta: `${Math.floor((100 - currentProgress) / 10)}s`
        } : null);
      }
    }, 1000);
  };

  const handleReset = () => {
    setStatus("idle");
    setMetadata(null);
    setJob(null);
    setErrorMessage("");
  };

  return (
    <div className="flex flex-col items-center justify-start py-12 md:py-20 min-h-screen bg-gray-50 px-4 md:px-6 flex-1">
      <div className="w-full max-w-4xl text-center mb-10">
        <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4">
          Download Your URL
        </h1>
        <p className="text-lg text-gray-600">
          Paste your YouTube link below to convert it easily to MP4 or MP3 formats.
        </p>
      </div>

      <URLInput 
        onSubmit={handleURLSubmit} 
        status={status} 
        errorMessage={status === "failed" && !job ? errorMessage : undefined} 
      />

      {status !== "idle" && status !== "fetching" && metadata && (!job || job.status === "processing" || job.status === "completed") && (
        <FormatSelector 
          metadata={metadata} 
          onDownload={handleDownloadStart} 
          isProcessing={status === "processing"} 
        />
      )}

      {job && (job.status === "processing" || job.status === "completed" || job.status === "failed") && (
        <DownloadProgress 
          job={job} 
          onReset={handleReset} 
        />
      )}
      
      <div className="mt-16 w-full max-w-2xl text-center text-sm text-gray-500">
        <p className="mb-2">
          By using our service you accept our <a href="#" className="underline hover:text-indigo-600">Terms of Service</a>.
        </p>
        <p>
          Downloading copyrighted material without permission is illegal. Keep to public domain or personal content only.
        </p>
      </div>
    </div>
  );
}
