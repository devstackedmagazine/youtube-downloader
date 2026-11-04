import { useEffect, useState } from "react";
import { api, type About as AboutInfo } from "../api";

export default function About() {
  const [about, setAbout] = useState<AboutInfo | null>(null);
  useEffect(() => { api.about().then(setAbout).catch(() => {}); }, []);
  if (!about) return null;
  const tools = Object.entries(about.sidecars).filter(([name, spec]) => !name.startsWith("_") && typeof spec === "object");

  return (
    <section aria-label="About" className="space-y-4">
      <h1 className="font-display text-4xl tracking-[-.07em]">About dltube {about.version}</h1>
      <p className="text-sm text-[#77736a]">Download YouTube videos, sections and playlists on your own computer. Use it only for content you have permission to keep.</p>
      <p className="text-sm text-[#77736a]">dltube is free software under the MIT License. The bundled tools below keep their own licenses.</p>
      <div className="card overflow-x-auto rounded-2xl bg-white p-6">
        <h2 className="font-semibold">Bundled tools</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-[#77736a]"><tr><th className="py-1 pr-4">Tool</th><th className="pr-4">Version</th><th className="pr-4">License</th><th>Source</th></tr></thead>
          <tbody>
            {tools.map(([name, spec]) => typeof spec === "object" && (
              <tr key={name} className="border-t border-[#11110f]/10 align-top">
                <td className="py-2 pr-4 font-semibold">{name}</td><td className="pr-4">{spec.version}</td><td className="pr-4">{spec.license}</td>
                <td className="select-all break-all">{spec.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="card rounded-2xl bg-white p-6">
        <summary className="cursor-pointer font-semibold">License (MIT)</summary>
        <pre className="mt-4 max-h-[50vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{about.license}</pre>
      </details>
      <details className="card rounded-2xl bg-white p-6">
        <summary className="cursor-pointer font-semibold">Third-party notices and licenses</summary>
        <pre className="mt-4 max-h-[50vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{about.notices}</pre>
      </details>
    </section>
  );
}
