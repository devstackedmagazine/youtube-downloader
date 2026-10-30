"use client";

import { ClipInput, ClipResult, formatTime, parseTime } from "@/lib/time";

interface SectionPickerProps {
  duration: number;
  value: ClipInput;
  onChange: (value: ClipInput) => void;
  result: ClipResult;
}

const inputClass = "h-12 w-full min-w-0 rounded-xl border border-[#11110f]/15 bg-[#f6f2e9] px-4 font-semibold tabular-nums outline-none transition focus:border-[#ff6b35]";
const linkClass = "rounded text-xs font-semibold text-[#77736a] underline-offset-4 transition hover:text-[#ff6b35] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6b35]";
const sliderClass = "w-full accent-[#ff6b35]";

export default function SectionPicker({ duration, value, onChange, result }: SectionPickerProps) {
  // Slider positions follow the text fields; unparsable text leaves the slider at the boundary.
  const startSeconds = Math.min(duration, parseTime(value.start) ?? 0);
  const endSeconds = Math.min(duration, value.end.trim() === "" ? duration : parseTime(value.end) ?? duration);

  return (
    <fieldset className="mt-4 rounded-2xl bg-[#f0ede5] p-4" aria-describedby="section-help section-status">
      <legend className="sr-only">Section to download</legend>
      <p id="section-help" className="text-xs text-[#77736a]">Use ss, mm:ss or hh:mm:ss. Leave start or end empty to use the start or end of the video.</p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="section-start" className="text-sm font-semibold text-[#11110f]">Start</label>
            <button type="button" className={linkClass} onClick={() => onChange({ ...value, start: "" })}>From the start</button>
          </div>
          <input id="section-start" type="text" inputMode="text" autoComplete="off" spellCheck={false} placeholder="0:00" value={value.start} onChange={(event) => onChange({ ...value, start: event.target.value })} aria-invalid={Boolean(result.error)} className={`mt-2 ${inputClass}`} />
          <label htmlFor="section-start-slider" className="sr-only">Start position</label>
          <input id="section-start-slider" type="range" min={0} max={duration} step={1} value={startSeconds} aria-valuetext={formatTime(startSeconds)} onChange={(event) => onChange({ ...value, start: formatTime(Number(event.target.value)) })} className={`mt-3 ${sliderClass}`} />
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="section-end" className="text-sm font-semibold text-[#11110f]">End</label>
            <button type="button" className={linkClass} onClick={() => onChange({ ...value, end: "" })}>To the end</button>
          </div>
          <input id="section-end" type="text" inputMode="text" autoComplete="off" spellCheck={false} placeholder={formatTime(duration)} value={value.end} onChange={(event) => onChange({ ...value, end: event.target.value })} aria-invalid={Boolean(result.error)} className={`mt-2 ${inputClass}`} />
          <label htmlFor="section-end-slider" className="sr-only">End position</label>
          <input id="section-end-slider" type="range" min={0} max={duration} step={1} value={endSeconds} aria-valuetext={formatTime(endSeconds)} onChange={(event) => onChange({ ...value, end: formatTime(Number(event.target.value)) })} className={`mt-3 ${sliderClass}`} />
        </div>
      </div>

      <p id="section-status" aria-live="polite" className={`mt-3 text-sm font-medium ${result.error ? "text-[#c33f1a]" : "text-[#11110f]"}`}>
        {result.error ?? `Section length: ${formatTime(result.length)}`}
      </p>
    </fieldset>
  );
}
