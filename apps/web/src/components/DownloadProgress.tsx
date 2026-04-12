"use client";

import { DownloadJob } from "@/types";

interface DownloadProgressProps {
  job: DownloadJob;
  onReset: () => void;
}

export default function DownloadProgress({ job, onReset }: DownloadProgressProps) {
  const { status, progress, eta, error_message, download_link } = job;

  const isCompleted = status === "completed";
  const isFailed = status === "failed";
  const isProcessing = status === "processing";

  return (
    <div className="w-full max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 mt-8 text-center">
      <h3 className="text-xl font-bold text-gray-900 mb-4">
        {isCompleted && "Download Ready!"}
        {isProcessing && "Converting your file..."}
        {isFailed && "Conversion Failed"}
      </h3>

      {isProcessing && (
        <div className="w-full mb-6">
          <div className="h-4 w-full bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-600 transition-all duration-300 ease-out" 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <div className="flex justify-between items-center mt-2 text-sm text-gray-500 font-medium">
            <span>{progress}%</span>
            <span>ETA: {eta}</span>
          </div>
        </div>
      )}

      {isCompleted && download_link && (
        <div className="mb-6 flex flex-col items-center gap-4">
          <p className="text-green-600 font-medium bg-green-50 px-4 py-2 rounded-md">
            File converted successfully and is ready to download!
          </p>
          <a
            href={download_link}
            download
            className="inline-flex h-12 w-full md:w-1/2 items-center justify-center rounded-md bg-green-600 px-6 text-base font-bold text-white shadow hover:bg-green-700 transition"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            Save File
          </a>
        </div>
      )}

      {isFailed && (
        <div className="mb-6 text-red-500 font-medium bg-red-50 px-4 py-3 rounded-md">
          {error_message || "An unexpected error occurred during conversion. Please try again."}
        </div>
      )}

      <button
        onClick={onReset}
        className="text-indigo-600 font-semibold text-sm hover:underline"
      >
        Download another video
      </button>
    </div>
  );
}
