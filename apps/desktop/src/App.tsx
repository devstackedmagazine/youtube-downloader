import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, type AppRelease, type Job } from "./api";
import DownloadForm from "./components/DownloadForm";
import Queue from "./components/Queue";
import History from "./components/History";
import SettingsPanel from "./components/SettingsPanel";
import About from "./components/About";

const tabs = ["Download", "History", "Settings", "About"] as const;
type Tab = (typeof tabs)[number];

export default function App() {
  const [tab, setTab] = useState<Tab>("Download");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [release, setRelease] = useState<AppRelease | null>(null);

  useEffect(() => {
    api.jobs().then(setJobs).catch(() => {});
    const unlisten = listen<Job[]>("jobs", (event) => setJobs(event.payload));
    // One check per launch; failures (offline) are silent.
    api.checkAppUpdate().then(setRelease).catch(() => {});
    return () => { void unlisten.then((stop) => stop()); };
  }, []);

  const active = jobs.filter((job) => job.status === "queued" || job.status === "running").length;

  return (
    <div className="min-h-screen bg-[#f6f2e9]">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#11110f] px-6 py-4 text-[#f6f2e9]">
        <span className="font-display text-2xl tracking-[-.06em]">dl<span className="text-[#ff6b35]">tube</span></span>
        <nav className="flex gap-1" aria-label="Sections">
          {tabs.map((item) => (
            <button key={item} type="button" aria-current={tab === item ? "page" : undefined} onClick={() => setTab(item)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === item ? "bg-[#f6f2e9] text-[#11110f]" : "text-[#bdb9af] hover:text-[#f6f2e9]"}`}>
              {item}{item === "Download" && active > 0 ? ` (${active})` : ""}
            </button>
          ))}
        </nav>
      </header>

      {release && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#ff6b35] px-6 py-3 text-sm font-semibold text-[#11110f]">
          <span>dltube {release.version} is available.</span>
          <button type="button" className="btn-ink rounded-full px-4 py-2" onClick={() => api.openRelease(release.url)}>Download ↗</button>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-6 py-8">
        {tab === "Download" && <><DownloadForm /><Queue jobs={jobs} /></>}
        {tab === "History" && <History />}
        {tab === "Settings" && <SettingsPanel />}
        {tab === "About" && <About />}
      </main>
    </div>
  );
}
