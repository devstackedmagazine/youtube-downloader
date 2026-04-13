import yt_dlp
import logging
import re
from typing import Dict, Optional

logger = logging.getLogger(__name__)

def validate_youtube_url(url: str) -> bool:
    """
    Validate if URL is a valid YouTube video.
    
    Accepts:
    - https://www.youtube.com/watch?v=dQw4w9WgXcQ
    - https://youtu.be/dQw4w9WgXcQ
    - youtube.com/watch?v=...
    - youtu.be/...
    """
    youtube_regex = r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/'
    
    if not re.search(youtube_regex, url):
        logger.warning(f"URL failed regex check: {url}")
        return False
    
    try:
        with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            video_id = info.get('id')
            if not video_id:
                return False
            logger.info(f"URL validated: {video_id}")
            return True
    except Exception as e:
        logger.error(f"yt-dlp validation error: {str(e)}")
        return False

def get_video_metadata(youtube_url: str) -> Dict:
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
            'skip_unavailable_fragments': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            
            # Extract best available formats
            formats = []
            if info.get('formats'):
                for fmt in info['formats']:
                    if fmt.get('ext') in ['mp4', 'm4a']:
                        formats.append({
                            'format_id': fmt.get('format_id'),
                            'height': fmt.get('height'),
                            'ext': fmt.get('ext'),
                            'filesize': fmt.get('filesize')
                        })
            
            metadata = {
                'id': info.get('id'),
                'title': info.get('title', 'Unknown Title'),
                'duration': info.get('duration', 0),
                'thumbnail_url': info.get('thumbnail'),
                'channel': info.get('uploader', 'Unknown Channel'),
                'formats': formats
            }
            
            logger.info(f"Metadata fetched: {metadata['id']} - {metadata['title']}")
            return metadata
    
    except Exception as e:
        logger.error(f"Failed to get video metadata: {str(e)}")
        raise ValueError(f"Could not fetch video information: {str(e)}")

def get_video_format_url(youtube_url: str, format_id: str = 'best') -> str:
    """
    Get the best format URL for downloading.
    """
    try:
        ydl_opts = {
            'quiet': True,
            'format': format_id,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            return info.get('url')
    
    except Exception as e:
        logger.error(f"Failed to get download URL: {str(e)}")
        raise ValueError(f"Could not get download URL: {str(e)}")

