"use client";

import { DownloadJob } from "@/types";

export default function DownloadProgress({ job, onReset }: { job: DownloadJob; onReset: () => void }) {
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";
  return (
    <div className="surface-hover surface-hover--dark rounded-[2rem] bg-[#11110f] p-7 text-[#f6f2e9] shadow-[0_24px_80px_rgba(17,17,15,.12)] sm:p-10">
      <div className="flex items-start justify-between gap-8"><div><p className="mb-3 text-sm uppercase tracking-[.16em] text-[#ff6b35]">{isCompleted ? "Your file is ready" : isFailed ? "Something went wrong" : "Working on it"}</p><h3 className="font-display text-5xl leading-[.9] tracking-[-.07em]">{isCompleted ? "Take it with you." : isFailed ? "Let’s try that again." : "Shaping your file."}</h3></div><span className="font-display text-5xl tracking-[-.07em] text-[#ff6b35]">{job.progress}%</span></div>
      {job.status === "processing" && <div className="mt-12"><div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#ff6b35] transition-all duration-500" style={{ width: `${job.progress}%` }} /></div><div className="mt-3 flex justify-between text-sm text-[#8b887f]"><span>Converting locally in the queue</span><span>ETA {job.eta}</span></div></div>}
      {isCompleted && job.download_link && <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center"><a href={job.download_link} download className="btn-paper inline-flex h-14 items-center justify-center rounded-full px-7 font-semibold">Save the file <span className="ml-3">↗</span></a><p className="text-sm text-[#8b887f]">Your download is ready.</p></div>}
      {isFailed && <p className="mt-8 rounded-2xl bg-[#c33f1a]/20 p-4 text-sm text-[#ffb59a]">{job.error_message || "The conversion could not be completed."}</p>}
      <button onClick={onReset} className="mt-10 text-sm font-semibold text-[#bdb9af] transition hover:text-[#ff6b35]">Start another download <span className="ml-2">↗</span></button>
    </div>
  );
}
