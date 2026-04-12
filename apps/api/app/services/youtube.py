import yt_dlp
import logging
import re

logger = logging.getLogger(__name__)

def validate_youtube_url(url: str) -> bool:
    """
    Validate if URL is a valid YouTube video.
    
    Accepts:
    - https://www.youtube.com/watch?v=dQw4w9WgXcQ
    - https://youtu.be/dQw4w9WgXcQ
    - youtube.com/watch?v=dQw4w9WgXcQ
    """
    # Quick regex check first
    youtube_regex = r'(https?://)?(www\.)?(youtube|youtu|youtube-nocookie)\.(com|be)/'
    
    if not re.search(youtube_regex, url):
        return False
    
    try:
        # Verify with yt-dlp
        with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            return bool(info.get('id'))
    except Exception as e:
        logger.error(f"URL validation failed: {str(e)}")
        return False

def get_video_metadata(youtube_url: str) -> dict:
    """
    Fetch video metadata from YouTube.
    
    Returns:
    {
        'id': 'dQw4w9WgXcQ',
        'title': 'Video Title',
        'duration': 213,
        'thumbnail_url': 'https://...',
        'channel': 'Channel Name'
    }
    """
    try:
        with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True}) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            
            return {
                'id': info.get('id'),
                'title': info.get('title'),
                'duration': info.get('duration'),
                'thumbnail_url': info.get('thumbnail'),
                'channel': info.get('uploader')
            }
    except Exception as e:
        logger.error(f"Failed to get video metadata: {str(e)}")
        raise ValueError(f"Could not fetch video: {str(e)}")
