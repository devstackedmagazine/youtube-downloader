"use client";

import { useEffect, useState } from "react";
import { DownloadStatus, VideoMetadata, VideoFormat, DownloadQuality, DownloadJob, DownloadScope } from "@/types";
import URLInput from "@/components/URLInput";
import FormatSelector from "@/components/FormatSelector";
import DownloadProgress from "@/components/DownloadProgress";
import { trackEvent } from "@/lib/analytics";
import { fetchMetadata, getDownloadStatus, startDownload } from "@/lib/api";

export default function DownloadPage() {
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [job, setJob] = useState<DownloadJob | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const jobId = job?.id;
  const jobStatus = job?.status;

  useEffect(() => {
    if (!jobId || jobStatus === "completed" || jobStatus === "failed") return;

    let cancelled = false;
    const poll = async () => {
      try {
        const nextJob = await getDownloadStatus(jobId);
        if (!cancelled) {
          setJob(nextJob);
          setStatus(nextJob.status);
        }
      } catch (error) {
        if (!cancelled) {
          setJob((current) => current ? { ...current, status: "failed", error_message: "We lost the conversion status. Please try again." } : current);
          setStatus("failed");
          trackEvent("download_status_failed", { jobId, error: String(error) });
        }
      }
    };

    void poll();
    const interval = window.setInterval(poll, 1200);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [jobId, jobStatus]);

  const handleURLSubmit = async (url: string) => {
    setStatus("fetching");
    setErrorMessage("");
    setSourceUrl(url);
    setMetadata(null);
    setJob(null);
    try {
      const videoMetadata = await fetchMetadata(url);
      setMetadata(videoMetadata);
      setStatus("ready");
      trackEvent("video_fetched", { videoId: videoMetadata.id });
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : "We could not read that link. Try copying it again.");
      trackEvent("video_fetch_failed", { error: String(error) });
    }
  };

  const handleDownloadStart = async (format: VideoFormat, quality: DownloadQuality, scope: DownloadScope) => {
    if (!metadata) return;
    if (!sourceUrl) return;
    setStatus("processing");
    setErrorMessage("");
    trackEvent("download_started", { videoId: metadata.id, format, quality, scope });
    try {
      const newJob = await startDownload(sourceUrl, format, quality, scope);
      setJob(newJob);
      setStatus(newJob.status);
    } catch (error) {
      setStatus("failed");
      setErrorMessage(error instanceof Error ? error.message : "We could not start that download.");
      trackEvent("download_start_failed", { videoId: metadata.id, error: String(error) });
    }
  };

  const handleReset = () => { setStatus("idle"); setMetadata(null); setJob(null); setSourceUrl(""); setErrorMessage(""); };

  return (
    <main className="w-full max-w-full overflow-x-hidden bg-[#f6f2e9]">
      <section className="surface-grid relative overflow-hidden bg-[#11110f] px-6 pb-24 pt-36 text-[#f6f2e9] sm:px-10 lg:px-16 lg:pb-32 lg:pt-48">
        <div className="absolute right-[-12rem] top-20 h-[34rem] w-[34rem] rounded-full bg-[#ff6b35]/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl"><div className="max-w-3xl"><p className="mb-8 text-sm uppercase tracking-[.2em] text-[#ff6b35]">Your download desk</p><h1 className="font-display max-w-6xl text-balance text-[clamp(3.5rem,7vw,7rem)] leading-[.86] tracking-[-.09em]">Drop a link.<br /><span className="text-[#ff6b35]">Keep the moment.</span></h1><p className="mt-9 max-w-xl text-lg leading-relaxed text-[#bdb9af]">Paste a YouTube URL below. We will pull the details, then hand you the cleanest format for the job.</p></div><div className="mt-14 max-w-4xl"><URLInput onSubmit={handleURLSubmit} status={status} errorMessage={status === "failed" && !job ? errorMessage : undefined} /></div><div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-xs uppercase tracking-[.16em] text-[#8b887f]"><span>MP4 video</span><span>MP3 audio</span><span>No account required</span></div></div>
      </section>

      <section className="px-6 py-16 sm:px-10 lg:px-16"><div className="mx-auto max-w-7xl">{status === "idle" || status === "fetching" ? <div className="grid gap-3 md:grid-cols-3"><div className="surface-hover surface-hover--light rounded-[1.5rem] bg-[#d9e7df] p-7"><p className="font-display text-4xl tracking-[-.06em]">01 / Paste</p><p className="mt-16 max-w-[13rem] text-sm leading-relaxed text-[#59564f]">Start with any YouTube video link you already have open.</p></div><div className="surface-hover surface-hover--light rounded-[1.5rem] bg-[#f2d2c2] p-7"><p className="font-display text-4xl tracking-[-.06em]">02 / Pick</p><p className="mt-16 max-w-[13rem] text-sm leading-relaxed text-[#59564f]">Choose the format that matches where you are taking it.</p></div><div className="surface-hover surface-hover--light rounded-[1.5rem] bg-[#ded8ed] p-7"><p className="font-display text-4xl tracking-[-.06em]">03 / Keep</p><p className="mt-16 max-w-[13rem] text-sm leading-relaxed text-[#59564f]">Download it straight to your device, ready when you are.</p></div></div> : <div className="mx-auto max-w-5xl">{metadata && !job && <FormatSelector metadata={metadata} onDownload={handleDownloadStart} isProcessing={status === "processing"} />}{job && <DownloadProgress job={job} onReset={handleReset} />}</div>}</div></section>

      <section className="border-t border-[#11110f]/10 px-6 py-20 sm:px-10 lg:px-16"><div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 md:flex-row md:items-end"><div><p className="mb-4 text-sm uppercase tracking-[.2em] text-[#77736a]">A small note</p><h2 className="font-display text-5xl leading-[.9] tracking-[-.07em] sm:text-6xl">Keep what you have<br />permission to keep.</h2></div><p className="max-w-sm text-sm leading-relaxed text-[#77736a]">DLTube is built for personal and permitted use. Respect the original creator and the rules of the platform.</p></div></section>
    </main>
  );
}
