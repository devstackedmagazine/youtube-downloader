"use client";

import { useState } from "react";
import { DownloadStatus, VideoMetadata, VideoFormat, DownloadQuality, DownloadJob } from "@/types";
import URLInput from "@/components/URLInput";
import FormatSelector from "@/components/FormatSelector";
import DownloadProgress from "@/components/DownloadProgress";
import ProtectedRoute from "@/lib/protected-route";
import { MOCK_VIDEOS } from "@/lib/mock-data";
import AdPlaceholder from "@/components/AdPlaceholder";
import { trackEvent } from "@/lib/analytics";

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
      
      // Extract video ID from URL for mocking (fallback to Rick Astley)
      let videoId = "dQw4w9WgXcQ"; 
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes("youtube.com")) {
          videoId = urlObj.searchParams.get("v") || videoId;
        } else if (urlObj.hostname.includes("youtu.be")) {
          videoId = urlObj.pathname.slice(1);
        }
      } catch (e) {}

      const mockData: VideoMetadata = MOCK_VIDEOS[videoId] || MOCK_VIDEOS["dQw4w9WgXcQ"];
      
      setMetadata(mockData);
      setStatus("ready");
      trackEvent("video_fetched", { videoId });
    } catch (e: unknown) {
      setStatus("failed");
      setErrorMessage("Failed to fetch video. Please check the URL and try again.");
      trackEvent("video_fetch_failed", { error: String(e) });
    }
  };

  const handleDownloadStart = async (format: VideoFormat, quality: DownloadQuality) => {
    if (!metadata) return;
    setStatus("processing");
    trackEvent("download_started", { videoId: metadata.id, format, quality });

    const mockJob: DownloadJob = {
      id: `job_${Math.random().toString(36).substr(2, 9)}`,
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
        trackEvent("download_completed", { jobId: mockJob.id });
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
    }, 800);
  };

  const handleReset = () => {
    setStatus("idle");
    setMetadata(null);
    setJob(null);
    setErrorMessage("");
  };

  return (
    <ProtectedRoute>
      <div className="flex flex-col items-center justify-start py-12 md:py-20 min-h-screen bg-gray-50 px-4 md:px-6 flex-1">
        
        <div className="w-full max-w-4xl mb-8">
          <AdPlaceholder className="h-24" />
        </div>

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
        
        <div className="mt-12 w-full max-w-4xl">
          <AdPlaceholder className="h-32" />
        </div>

        <div className="mt-12 w-full max-w-2xl text-center text-sm text-gray-500">
          <p className="mb-2">
            By using our service you accept our <a href="#" className="underline hover:text-indigo-600">Terms of Service</a>.
          </p>
          <p>
            Downloading copyrighted material without permission is illegal. Keep to public domain or personal content only.
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
