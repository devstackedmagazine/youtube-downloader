import ffmpeg
import os
import yt_dlp
import logging

logger = logging.getLogger(__name__)

async def download_video(youtube_url: str, output_path: str, format: str = 'mp4'):
    """
    Download a YouTube video using yt-dlp to the specified output path.
    """
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' if format == 'mp4' else 'bestaudio/best',
        'outtmpl': output_path,
        'quiet': True,
        'no_warnings': True,
    }
    
    if format == 'mp3':
        ydl_opts['postprocessors'] = [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }]

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([youtube_url])
            # yt-dlp might append .mp3 if postprocessor is used
            if format == 'mp3' and not os.path.exists(output_path) and os.path.exists(output_path + '.mp3'):
                os.rename(output_path + '.mp3', output_path)
            elif format == 'mp3' and output_path.endswith('.mp4') and os.path.exists(output_path.replace('.mp4', '.mp3')):
                os.rename(output_path.replace('.mp4', '.mp3'), output_path)
            
            # ensure the file exists
            if not os.path.exists(output_path):
                 
                 # check if it downloaded as webm or something else and rename
                 base, _ = os.path.splitext(output_path)
                 for ext in ['.webm', '.mkv', '.m4a']:
                     if os.path.exists(base + ext):
                         os.rename(base + ext, output_path)
                         break
                 
                 if not os.path.exists(output_path):
                     raise FileNotFoundError(f"Downloaded file not found at {output_path}")

            logger.info(f"Successfully downloaded {youtube_url} to {output_path}")
            return output_path
            
    except Exception as e:
        logger.error(f"Failed to download video: {str(e)}")
        raise e


async def convert_to_mp4(input_path: str, output_path: str, quality: str = '720p'):
    """
    Convert a downloaded video file to MP4 format using FFmpeg.
    """
    try:
        # Map quality string to resolution
        scale_map = {
            '1080p': '1920:1080',
            '720p': '1280:720',
            '480p': '854:480',
            '360p': '640:360',
            '240p': '426:240'
        }
        
        scale = scale_map.get(quality, '1280:720') # Default 720p
        
        stream = ffmpeg.input(input_path)
        stream = ffmpeg.output(stream, output_path, vcodec='libx264', acodec='aac', strict='experimental', vf=f'scale={scale}')
        ffmpeg.run(stream, overwrite_output=True, quiet=True)
        
        logger.info(f"Successfully converted {input_path} to MP4 ({quality}) at {output_path}")
        return output_path
        
    except ffmpeg.Error as e:
        error_message = e.stderr.decode('utf-8') if e.stderr else str(e)
        logger.error(f"FFmpeg MP4 conversion failed: {error_message}")
        raise RuntimeError(f"FFmpeg conversion failed: {error_message}")
    except Exception as e:
        logger.error(f"Failed to convert video: {str(e)}")
        raise e

async def convert_to_mp3(input_path: str, output_path: str):
    """
    Extract audio from a video file and convert to MP3 format using FFmpeg.
    """
    try:
        stream = ffmpeg.input(input_path)
        stream = ffmpeg.output(stream, output_path, acodec='libmp3lame', ab='192k')
        ffmpeg.run(stream, overwrite_output=True, quiet=True)
        
        logger.info(f"Successfully converted {input_path} to MP3 at {output_path}")
        return output_path
        
    except ffmpeg.Error as e:
        error_message = e.stderr.decode('utf-8') if e.stderr else str(e)
        logger.error(f"FFmpeg MP3 conversion failed: {error_message}")
        raise RuntimeError(f"FFmpeg conversion failed: {error_message}")
    except Exception as e:
        logger.error(f"Failed to convert video: {str(e)}")
        raise e
