"use client";

import { useForm } from "react-hook-form";
import { DownloadStatus } from "@/types";

interface URLInputProps {
  onSubmit: (url: string) => void;
  status: DownloadStatus;
  errorMessage?: string;
}

interface FormData {
  youtubeUrl: string;
}

export default function URLInput({ onSubmit, status, errorMessage }: URLInputProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();
  const isFetching = status === "fetching";

  const onFormSubmit = (data: FormData) => {
    onSubmit(data.youtubeUrl);
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-200">
      <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col gap-4">
        <label htmlFor="youtubeUrl" className="text-lg font-semibold text-gray-900">
          Enter YouTube Video URL
        </label>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            id="youtubeUrl"
            type="url"
            disabled={isFetching}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 px-4 py-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors disabled:opacity-50"
            {...register("youtubeUrl", { 
              required: "Please enter a valid YouTube URL",
              pattern: {
                value: /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/,
                message: "Must be a valid YouTube URL"
              }
            })}
          />
          <button
            type="submit"
            disabled={isFetching}
            className="md:w-auto w-full px-8 py-3 bg-indigo-600 text-white font-bold rounded-md hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isFetching ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Fetching...
              </>
            ) : "Load Video"}
          </button>
        </div>
        {(errors.youtubeUrl || errorMessage) && (
          <p className="text-red-500 text-sm font-medium">
            {errors.youtubeUrl?.message || errorMessage}
          </p>
        )}
      </form>
    </div>
  );
}
