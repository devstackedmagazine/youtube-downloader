"use client";

import { useForm } from "react-hook-form";
import { DownloadStatus } from "@/types";

interface URLInputProps { onSubmit: (url: string) => void; status: DownloadStatus; errorMessage?: string; }
interface FormData { youtubeUrl: string; }

export default function URLInput({ onSubmit, status, errorMessage }: URLInputProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const isFetching = status === "fetching";
  return (
    <div className="input-shell surface-hover surface-hover--light rounded-[1.75rem] border border-white/15 bg-[#f6f2e9] p-2 text-[#11110f] transition duration-300 sm:p-3">
      <form onSubmit={handleSubmit((data) => onSubmit(data.youtubeUrl))}>
        <div className="flex flex-col gap-2 sm:flex-row"><label htmlFor="youtubeUrl" className="sr-only">YouTube URL</label><input id="youtubeUrl" type="url" disabled={isFetching} placeholder="https://youtube.com/watch?v=..." className="min-h-14 min-w-0 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-[#8f8a80] disabled:opacity-50 sm:min-h-16 sm:px-5" {...register("youtubeUrl", { required: "Paste a YouTube link to continue", pattern: { value: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/, message: "That does not look like a YouTube link" } })} /><button type="submit" disabled={isFetching} className="btn-signal inline-flex min-h-14 items-center justify-center rounded-full px-7 font-semibold disabled:cursor-wait disabled:opacity-60 sm:min-h-16">{isFetching ? "Reading link..." : "Load video"}<span className="ml-3 text-lg">↗</span></button></div>
        {(errors.youtubeUrl || errorMessage) && <p className="px-4 pb-2 pt-2 text-sm font-medium text-[#c33f1a]">{errors.youtubeUrl?.message || errorMessage}</p>}
      </form>
    </div>
  );
}
