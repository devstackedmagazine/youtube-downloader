import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, errorText, type HistoryEntry } from "../api";
import { sectionLabel } from "../format";

export default function History() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => api.history().then(setEntries).catch((e) => setError(errorText(e)));
    refresh();
    const unlisten = listen("history-changed", refresh);
    return () => { void unlisten.then((stop) => stop()); };
  }, []);

  const run = (action: Promise<void>) => action.then(() => setError("")).catch((e) => setError(errorText(e)));
  const clear = () => run(api.clearHistory().then(() => setEntries([])));

  return (
    <section aria-label="History">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl tracking-[-.07em]">History</h1>
        {entries.length > 0 && <button type="button" onClick={clear} className="btn-paper rounded-full px-4 py-2 text-sm font-semibold">Clear history</button>}
      </div>
      <p className="mt-2 text-sm text-[#77736a]">Clearing the history doesn't delete any files.</p>
      {error && <p className="mt-4 text-sm font-medium text-[#c33f1a]" role="alert">{error}</p>}
      {entries.length === 0 && <p className="mt-8 text-[#77736a]">Nothing downloaded yet.</p>}
      <ul className="mt-6 space-y-3">
        {entries.map((entry) => (
          <li key={entry.id} className="card flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5">
            <div className="min-w-0">
              <p className="truncate font-semibold">{entry.title}</p>
              <p className="mt-1 text-sm text-[#77736a]">
                {[entry.format.toUpperCase(), entry.quality, sectionLabel(entry.start, entry.end, 0), entry.playlist ? `${entry.items} items` : "",
                  new Date(entry.date * 1000).toLocaleString()].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 truncate text-xs text-[#8f8a80]" title={entry.path}>{entry.path}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => run(api.openEntry(entry.id, false))} className="btn-ink rounded-full px-4 py-2 text-sm font-semibold">{entry.playlist ? "Open folder" : "Open file"}</button>
              <button type="button" onClick={() => run(api.openEntry(entry.id, true))} className="btn-paper rounded-full px-4 py-2 text-sm font-semibold">Show in folder</button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
