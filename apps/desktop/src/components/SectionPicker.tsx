// Same controls as apps/web/src/components/SectionPicker.tsx, using the shared rules.
import { type ClipInput, type ClipResult, formatTime, parseTime } from "@dltube/shared/time";

interface Props {
  duration: number;
  value: ClipInput;
  onChange: (value: ClipInput) => void;
  result: ClipResult;
}

const inputClass = "mt-2 h-12 w-full min-w-0 rounded-xl border border-[#11110f]/15 bg-[#f6f2e9] px-4 font-semibold tabular-nums outline-none focus:border-[#ff6b35]";
const linkClass = "rounded text-xs font-semibold text-[#77736a] underline-offset-4 hover:text-[#ff6b35] hover:underline";

export default function SectionPicker({ duration, value, onChange, result }: Props) {
  const startSeconds = Math.min(duration, parseTime(value.start) ?? 0);
  const endSeconds = Math.min(duration, value.end.trim() === "" ? duration : parseTime(value.end) ?? duration);
  const field = (key: "start" | "end", label: string, shortcut: string, placeholder: string, seconds: number) => (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={`section-${key}`} className="text-sm font-semibold">{label}</label>
        <button type="button" className={linkClass} onClick={() => onChange({ ...value, [key]: "" })}>{shortcut}</button>
      </div>
      <input id={`section-${key}`} type="text" autoComplete="off" spellCheck={false} placeholder={placeholder} value={value[key]}
        onChange={(event) => onChange({ ...value, [key]: event.target.value })} aria-invalid={Boolean(result.error)} className={inputClass} />
      <label htmlFor={`section-${key}-slider`} className="sr-only">{label} position</label>
      <input id={`section-${key}-slider`} type="range" min={0} max={duration} step={1} value={seconds} aria-valuetext={formatTime(seconds)}
        onChange={(event) => onChange({ ...value, [key]: formatTime(Number(event.target.value)) })} className="mt-3 w-full accent-[#ff6b35]" />
    </div>
  );

  return (
    <fieldset className="mt-4 rounded-2xl bg-[#f0ede5] p-4" aria-describedby="section-help section-status">
      <legend className="sr-only">Section to download</legend>
      <p id="section-help" className="text-xs text-[#77736a]">Use ss, mm:ss or hh:mm:ss. Leave start or end empty to use the start or end of the video.</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {field("start", "Start", "From the start", "0:00", startSeconds)}
        {field("end", "End", "To the end", formatTime(duration), endSeconds)}
      </div>
      <p id="section-status" aria-live="polite" className={`mt-3 text-sm font-medium ${result.error ? "text-[#c33f1a]" : ""}`}>
        {result.error ?? `Section length: ${formatTime(result.length)}`}
      </p>
    </fieldset>
  );
}
