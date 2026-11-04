import { useEffect, useState } from "react";
import { api, errorText, type Settings } from "../api";

export default function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => api.settings().then(setSettings).catch((e) => setMessage(errorText(e)));
  useEffect(() => { refresh(); }, []);

  const chooseFolder = async () => {
    try {
      if (await api.chooseOutputDir()) await refresh();
    } catch (e) {
      setMessage(errorText(e));
    }
  };

  const updateNow = async () => {
    setBusy(true);
    setMessage("Checking for a new yt-dlp…");
    try {
      setMessage(await api.updateYtdlp());
      await refresh();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async (enabled: boolean) => {
    await api.setAutoUpdate(enabled).catch((e) => setMessage(errorText(e)));
    await refresh();
  };

  if (!settings) return <p className="text-[#77736a]">{message || "Loading…"}</p>;

  return (
    <section aria-label="Settings" className="space-y-4">
      <h1 className="font-display text-4xl tracking-[-.07em]">Settings</h1>

      <div className="card rounded-2xl bg-white p-6">
        <h2 className="font-semibold">Download folder</h2>
        <p className="mt-2 break-all text-sm text-[#77736a]">{settings.output_dir}</p>
        <button type="button" onClick={chooseFolder} className="btn-ink mt-4 rounded-full px-5 py-2 text-sm font-semibold">Change folder</button>
      </div>

      <div className="card rounded-2xl bg-white p-6">
        <h2 className="font-semibold">yt-dlp</h2>
        <p className="mt-2 text-sm text-[#77736a]">
          Version {settings.ytdlp_version || "unknown"}. YouTube changes often; a fresh yt-dlp keeps downloads working.
          {settings.last_check > 0 && ` Last checked ${new Date(settings.last_check * 1000).toLocaleString()}.`}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button type="button" onClick={updateNow} disabled={busy} className="btn-signal rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60">Update now</button>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={settings.auto_update} onChange={(e) => toggleAuto(e.target.checked)} className="h-4 w-4 accent-[#ff6b35]" />
            Check for updates automatically (once a day)
          </label>
        </div>
      </div>

      {message && <p className="text-sm font-medium" role="status">{message}</p>}
      <p className="text-sm text-[#77736a]">dltube {settings.app_version}. No account, no analytics: it only talks to YouTube (through yt-dlp) and GitHub (update checks).</p>
    </section>
  );
}
