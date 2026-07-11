import yt_dlp
import logging
import re
from typing import Any, Dict
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

def validate_youtube_url(url: str) -> bool:
    """Perform cheap, deterministic validation before calling yt-dlp."""
    parsed = urlparse(url if "://" in url else f"https://{url}")
    host = (parsed.hostname or "").lower()
    return parsed.scheme in {"http", "https"} and (
        host == "youtu.be" or host == "youtube.com" or host.endswith(".youtube.com")
    )

def get_video_metadata(youtube_url: str) -> Dict[str, Any]:
    """
    Fetch complete video metadata from YouTube.
    
    Returns:
    {
        'id': 'dQw4w9WgXcQ',
        'title': 'Rick Astley - Never Gonna Give You Up',
        'duration': 213,
        'thumbnail_url': 'https://i.ytimg.com/vi/...',
        'channel': 'Rick Astley',
        'formats': [...]  # Available formats for selection
    }
    """
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'extract_flat': 'discard_in_playlist',
            'extractor_args': {'youtube': {'player_client': ['android', 'web']}},
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            
            is_playlist = info.get('_type') == 'playlist' or bool(info.get('entries'))
            # Formats only apply to a single video. A playlist is downloaded with
            # the same selected format for every item and returned as a ZIP.
            formats = []
            if not is_playlist and info.get('formats'):
                for fmt in info['formats']:
                    if fmt.get('ext') in ['mp4', 'm4a']:
                        formats.append({
                            'format_id': fmt.get('format_id'),
                        'resolution': f"{fmt.get('height')}p" if fmt.get('height') else "audio",
                        'quality': fmt.get('height') or fmt.get('abr') or 0,
                            'ext': fmt.get('ext'),
                            'filesize': fmt.get('filesize')
                        })
            
            metadata = {
                'id': info.get('id'),
                'title': info.get('title', 'Unknown Title'),
                'duration': info.get('duration', 0),
                'thumbnail_url': info.get('thumbnail'),
                'channel': info.get('uploader', 'Unknown Channel'),
                'formats': formats,
                'is_playlist': is_playlist,
                'playlist_count': info.get('playlist_count') or (len(info.get('entries') or []) if is_playlist else 0),
                'playlist_title': info.get('title') if is_playlist else None,
            }
            
            logger.info(f"Metadata fetched: {metadata['id']} - {metadata['title']}")
            return metadata
    
    except Exception as e:
        logger.error(f"Failed to get video metadata: {str(e)}")
        raise ValueError(f"Could not fetch video information: {str(e)}")
