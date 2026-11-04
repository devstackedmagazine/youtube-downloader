import { api, type Job } from "../api";
import { formatBytes, formatEta, formatSpeed, sectionLabel } from "../format";

const statusText: Record<Job["status"], string> = {
  queued: "Waiting",
  running: "Downloading",
  done: "Saved",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default function Queue({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) return null;
  const finished = jobs.some((job) => job.status !== "queued" && job.status !== "running");

  return (
    <section className="mt-8" aria-label="Downloads">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl tracking-[-.06em]">Queue</h2>
        {finished && <button type="button" onClick={() => api.clearFinished()} className="text-sm font-semibold text-[#77736a] hover:text-[#ff6b35]">Clear finished</button>}
      </div>
      <ul className="mt-4 space-y-3">
        {jobs.map((job) => <JobRow key={job.id} job={job} />)}
      </ul>
    </section>
  );
}

function JobRow({ job }: { job: Job }) {
  const { request: req, progress: p } = job;
  const running = job.status === "running";
  const processing = running && p && p.status !== "downloading";
  const percent = p?.percent ?? null;
  const details = [
    req.format.toUpperCase(),
    req.quality,
    sectionLabel(req.start, req.end, req.duration),
    running && p?.item && p.items ? `Item ${p.item} of ${p.items}` : "",
    running && !processing ? [formatBytes(p?.downloaded_bytes ?? null), formatSpeed(p?.speed ?? null), formatEta(p?.eta_seconds ?? null)].filter(Boolean).join(" · ") : "",
    processing ? "Processing…" : "",
  ].filter(Boolean);

  return (
    <li className="card rounded-2xl bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold">{req.title}</p>
          <p className="mt-1 text-sm text-[#77736a]">{statusText[job.status]} · {details.join(" · ")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {(job.status === "queued" || running) && <button type="button" onClick={() => api.cancel(job.id)} className="btn-paper rounded-full px-4 py-2 text-sm font-semibold">Cancel</button>}
          {job.status === "done" && <>
            <button type="button" onClick={() => api.openEntry(job.id, false)} className="btn-ink rounded-full px-4 py-2 text-sm font-semibold">{req.playlist ? "Open folder" : "Open file"}</button>
            <button type="button" onClick={() => api.openEntry(job.id, true)} className="btn-paper rounded-full px-4 py-2 text-sm font-semibold">Show in folder</button>
          </>}
        </div>
      </div>
      {running && (
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#11110f]/10" role="progressbar" aria-label={`Downloading ${req.title}`}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent === null ? undefined : Math.round(percent)}>
          <div className={`h-full rounded-full bg-[#ff6b35] transition-all duration-300 ${percent === null ? "w-1/3 animate-pulse" : ""}`}
            style={percent === null ? undefined : { width: `${percent}%` }} />
        </div>
      )}
      {job.status === "failed" && <p className="mt-3 rounded-xl bg-[#c33f1a]/10 p-3 text-sm text-[#c33f1a]" role="alert">{job.error}</p>}
    </li>
  );
}
