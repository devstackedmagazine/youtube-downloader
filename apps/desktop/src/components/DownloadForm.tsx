import { type FormEvent, useState } from "react";
import { checkClip, formatTime } from "@dltube/shared/time";
import { type DownloadQuality, MP3_QUALITIES, MP4_QUALITIES, QUALITY_LABELS, type VideoFormat } from "@dltube/shared/types";
import { api, errorText, type Metadata } from "../api";
import SectionPicker from "./SectionPicker";

// Quick client-side check; Rust validates again (dltube-core/src/url.rs).
const YOUTUBE = /^(https?:\/\/)?([a-z0-9-]+\.)*(youtube\.com|youtu\.be)\/\S+$/i;

const toggleClass = (active: boolean) => `toggle rounded-xl px-3 py-3 text-left text-sm ${active ? "is-active" : "text-[#77736a] hover:bg-[#f6f2e9]"}`;

export default function DownloadForm() {
  const [url, setUrl] = useState("");
  const [loadedUrl, setLoadedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // The playlist view of a watch?v=..&list=.. link, and the single video it points at.
  const [playlistMeta, setPlaylistMeta] = useState<Metadata | null>(null);
  const [videoMeta, setVideoMeta] = useState<Metadata | null>(null);
  const [scope, setScope] = useState<"playlist" | "single">("single");
  const [format, setFormat] = useState<VideoFormat>("mp4");
  const [quality, setQuality] = useState<DownloadQuality>("1080p");
  const [wantsSection, setWantsSection] = useState(false);
  const [section, setSection] = useState({ start: "", end: "" });

  const meta = scope === "playlist" ? playlistMeta : videoMeta;

  const load = async (event: FormEvent) => {
    event.preventDefault();
    const link = url.trim();
    if (!YOUTUBE.test(link)) return setError("That doesn't look like a YouTube link. Paste a youtube.com or youtu.be URL.");
    setLoading(true);
    setError("");
    setNotice("");
    setPlaylistMeta(null);
    setVideoMeta(null);
    try {
      const result = await api.metadata(link, false);
      setLoadedUrl(link);
      setWantsSection(false);
      setSection({ start: "", end: "" });
      if (result.is_playlist) {
        setPlaylistMeta(result);
        setScope("playlist");
      } else {
        setVideoMeta(result);
        setScope("single");
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };

  const chooseScope = async (next: "playlist" | "single") => {
    setScope(next);
    if (next === "single" && !videoMeta) {
      setLoading(true);
      try {
        setVideoMeta(await api.metadata(loadedUrl, true));
      } catch (e) {
        setError(errorText(e));
        setScope("playlist");
      } finally {
        setLoading(false);
      }
    }
  };

  const changeFormat = (next: VideoFormat) => {
    setFormat(next);
    setQuality(next === "mp4" ? "1080p" : "320kbps");
  };

  if (!meta && !loading) {
    return <UrlBox url={url} setUrl={setUrl} onSubmit={load} loading={loading} error={error} />;
  }

  const isPlaylist = scope === "playlist";
  // A single video loaded from a pure playlist link is still a playlist: no sections then.
  const canSection = Boolean(meta) && !isPlaylist && !meta!.is_playlist && !meta!.is_live && meta!.duration > 0;
  const useSection = canSection && wantsSection;
  const clip = checkClip(section, meta?.duration ?? 0);
  const blocker = meta?.is_live ? "Live streams can't be downloaded. Try again after the stream has ended." : useSection ? clip.error : null;

  const add = async () => {
    if (!meta || blocker) return;
    try {
      await api.enqueue({
        url: loadedUrl,
        format,
        quality,
        playlist: isPlaylist,
        start: useSection ? clip.start_time : null,
        end: useSection ? clip.end_time : null,
        title: (isPlaylist ? meta.playlist_title : null) || meta.title,
        duration: meta.duration,
      });
      setNotice("Added to the queue. Paste another link whenever you like.");
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div>
      <UrlBox url={url} setUrl={setUrl} onSubmit={load} loading={loading} error={meta ? "" : error} />
      {meta && (
        <div className="card mt-6 overflow-hidden rounded-[2rem] border border-[#11110f]/10 bg-white">
          <div className="grid md:grid-cols-[.8fr_1.2fr]">
            <div className="relative min-h-[240px] overflow-hidden bg-[#11110f]">
              {meta.thumbnail && <img src={meta.thumbnail} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-85" />}
              <div className="absolute inset-0 bg-gradient-to-t from-[#11110f]/90 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-[#f6f2e9]">
                <p className="mb-2 text-xs uppercase tracking-[.16em] text-[#ff6b35]">{isPlaylist ? "Playlist ready" : "Ready to shape"}</p>
                <h2 className="font-display text-3xl leading-[.95] tracking-[-.06em]">{(isPlaylist && meta.playlist_title) || meta.title}</h2>
                <p className="mt-3 text-sm text-[#bdb9af]">{isPlaylist ? `${meta.playlist_count || "Multiple"} videos` : `${meta.channel} · ${formatTime(meta.duration)}`}</p>
              </div>
            </div>

            <div className="flex flex-col justify-between p-6 sm:p-8">
              <div>
                {playlistMeta && (
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#f0ede5] p-2" role="group" aria-label="Download selection">
                    <button type="button" aria-pressed={isPlaylist} onClick={() => chooseScope("playlist")} className={toggleClass(isPlaylist)}>Whole playlist<span className="mt-1 block text-xs opacity-70">Into a folder</span></button>
                    <button type="button" aria-pressed={!isPlaylist} onClick={() => chooseScope("single")} className={toggleClass(!isPlaylist)}>Current video<span className="mt-1 block text-xs opacity-70">One file</span></button>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#f0ede5] p-2" role="group" aria-label="Format">
                  {(["mp4", "mp3"] as const).map((item) => (
                    <button key={item} type="button" aria-pressed={format === item} onClick={() => changeFormat(item)} className={toggleClass(format === item)}>
                      <span className="block font-display text-2xl tracking-[-.05em]">{item.toUpperCase()}</span>
                      <span className="mt-1 block text-xs opacity-70">{item === "mp4" ? "Video" : "Audio"}</span>
                    </button>
                  ))}
                </div>
                {canSection && (
                  <>
                    <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-[#f0ede5] p-2" role="group" aria-label="What to download">
                      <button type="button" aria-pressed={!wantsSection} onClick={() => setWantsSection(false)} className={toggleClass(!wantsSection)}>Whole video<span className="mt-1 block text-xs opacity-70">{formatTime(meta.duration)}</span></button>
                      <button type="button" aria-pressed={wantsSection} onClick={() => setWantsSection(true)} className={toggleClass(wantsSection)}>Download a section<span className="mt-1 block text-xs opacity-70">Pick start and end</span></button>
                    </div>
                    {useSection && <SectionPicker duration={meta.duration} value={section} onChange={setSection} result={clip} />}
                  </>
                )}
                <label className="mt-5 block text-sm font-semibold" htmlFor="quality">Quality</label>
                <select id="quality" value={quality} onChange={(event) => setQuality(event.target.value as DownloadQuality)}
                  className="mt-2 h-12 w-full rounded-xl border border-[#11110f]/15 bg-[#f6f2e9] px-4 font-semibold outline-none focus:border-[#ff6b35]">
                  {(format === "mp4" ? MP4_QUALITIES : MP3_QUALITIES).map((item) => <option key={item} value={item}>{QUALITY_LABELS[item] ?? item}</option>)}
                </select>
                {format === "mp4" && <p className="mt-2 text-xs text-[#77736a]">{quality === "best" ? "Highest resolution YouTube has, often AV1 or VP9. Older players and Windows' built-in player may not play it." : "H.264 + AAC when YouTube has it, so it plays in any player."}</p>}
              </div>
              <div>
                {blocker && !useSection && <p className="mt-5 text-sm font-medium text-[#c33f1a]">{blocker}</p>}
                {error && <p className="mt-5 text-sm font-medium text-[#c33f1a]" role="alert">{error}</p>}
                {notice && <p className="mt-5 text-sm font-medium text-[#4b6a59]" role="status">{notice}</p>}
                <button type="button" onClick={add} disabled={loading || Boolean(blocker)}
                  className="btn-signal mt-6 inline-flex h-14 w-full items-center justify-center rounded-full font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                  {isPlaylist ? "Download playlist" : useSection ? "Download section" : "Download"}<span className="ml-3">↓</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UrlBox({ url, setUrl, onSubmit, loading, error }: { url: string; setUrl: (v: string) => void; onSubmit: (e: FormEvent) => void; loading: boolean; error: string }) {
  return (
    <section className="card-dark rounded-[2rem] bg-[#11110f] p-6 text-[#f6f2e9] sm:p-8">
      <p className="text-sm uppercase tracking-[.2em] text-[#ff6b35]">Your download desk</p>
      <h1 className="mt-3 font-display text-5xl leading-[.9] tracking-[-.08em]">Drop a link. <span className="text-[#ff6b35]">Keep the moment.</span></h1>
      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-2 rounded-[1.5rem] bg-[#f6f2e9] p-2 text-[#11110f] sm:flex-row">
        <label htmlFor="url" className="sr-only">YouTube URL</label>
        <input id="url" type="text" inputMode="url" autoComplete="off" spellCheck={false} value={url} disabled={loading} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=..." className="min-h-14 min-w-0 flex-1 bg-transparent px-4 outline-none placeholder:text-[#8f8a80] disabled:opacity-50" />
        <button type="submit" disabled={loading} className="btn-signal inline-flex min-h-14 items-center justify-center rounded-full px-7 font-semibold disabled:cursor-wait disabled:opacity-60">
          {loading ? "Reading link..." : "Load video"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm font-medium text-[#ffb59a]" role="alert">{error}</p>}
    </section>
  );
}
