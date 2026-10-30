import logging
from typing import Any, Dict
from urllib.parse import urlparse

import yt_dlp

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Only YouTube extractors are loaded, so yt-dlp can't be used to fetch arbitrary URLs (SSRF).
ALLOWED_EXTRACTORS = ["youtube", "youtube:.*"]
LIVE_STATUSES = {"is_live", "is_upcoming"}


def validate_youtube_url(url: str) -> bool:
    """Perform cheap, deterministic validation before calling yt-dlp."""
    if len(url) > 2048:
        return False
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = (parsed.hostname or "").lower()
    return parsed.scheme in {"http", "https"} and (
        host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com")
    )


def base_ydl_options() -> Dict[str, Any]:
    options: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "allowed_extractors": ALLOWED_EXTRACTORS,
        "socket_timeout": 30,
    }
    if settings.yt_player_clients:
        options["extractor_args"] = {"youtube": {"player_client": settings.yt_player_clients}}
    return options


def is_live(info: Dict[str, Any]) -> bool:
    return bool(info.get("is_live")) or info.get("live_status") in LIVE_STATUSES


def get_video_metadata(youtube_url: str, single: bool = False) -> Dict[str, Any]:
    """Fetch video (or flat playlist) metadata in the shape GET /api/metadata returns.

    ``single`` ignores the playlist part of watch?v=...&list=... URLs.
    """
    try:
        ydl_opts = {
            **base_ydl_options(),
            "skip_download": True,
            "noplaylist": single,
            # Playlist metadata must stay flat. ``discard_in_playlist`` resolves
            # every entry before discarding it, which makes metadata requests
            # time out for even moderately sized playlists.
            "extract_flat": "in_playlist",
            "playlistend": settings.MAX_PLAYLIST_ITEMS,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)

        is_playlist = info.get("_type") == "playlist" or bool(info.get("entries"))
        # Formats only apply to a single video. A playlist is downloaded with
        # the same selected format for every item and returned as a ZIP.
        formats = []
        if not is_playlist and info.get("formats"):
            for fmt in info["formats"]:
                if fmt.get("ext") in ["mp4", "m4a"]:
                    formats.append({
                        "format_id": fmt.get("format_id"),
                        "resolution": f"{fmt.get('height')}p" if fmt.get("height") else "audio",
                        "quality": fmt.get("height") or fmt.get("abr") or 0,
                        "ext": fmt.get("ext"),
                        "filesize": fmt.get("filesize"),
                    })

        metadata = {
            "id": info.get("id"),
            "title": info.get("title") or "Unknown Title",
            "duration": info.get("duration") or 0,
            "thumbnail": info.get("thumbnail"),
            "channel": info.get("uploader") or info.get("channel") or "Unknown Channel",
            "formats": formats,
            "is_live": is_live(info),
            "is_playlist": is_playlist,
            "playlist_count": info.get("playlist_count") or (len(info.get("entries") or []) if is_playlist else 0),
            "playlist_title": info.get("title") if is_playlist else None,
        }

        logger.info("Metadata fetched: %s - %s", metadata["id"], metadata["title"])
        return metadata

    except Exception as e:
        logger.warning("Failed to get video metadata: %s", e)
        raise ValueError(f"Could not fetch video information: {e}") from e
