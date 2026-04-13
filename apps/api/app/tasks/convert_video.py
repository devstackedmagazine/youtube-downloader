import asyncio
from app.tasks.celery_app import celery_app
from app.dependencies import get_db
from app.models.download import Download
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import os
import uuid

# Define database connection statically for celery tasks Since we are inside a blocking process we need a sync session
DATABASE_URL_SYNC = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/ytdb").replace("postgresql+asyncpg", "postgresql")
engine_sync = create_engine(DATABASE_URL_SYNC)
SessionLocalSync = sessionmaker(autocommit=False, autoflush=False, bind=engine_sync)

@celery_app.task(bind=True)
def convert_video_task(self, download_id: str):
    """
    Celery task that handles downloading and converting a YouTube video.
    This runs asynchronously in the background.
    """
    # Create sync DB session to update download status
    db = SessionLocalSync()

    try:
        # 1. Update status to 'processing'
        download = db.query(Download).filter(Download.id == download_id).first()
        if not download:
            print(f"Download {download_id} not found.")
            return

        download.status = "processing"
        
        # We start with 10% progress
        download.progress = 10.0
        db.commit()

        # Generate output paths
        base_dir = os.path.join(os.getcwd(), 'tmp_downloads')
        os.makedirs(base_dir, exist_ok=True)
        # Using the video id or uuid to avoid conflicts
        unique_id = str(uuid.uuid4())
        output_filename = f"{download.video_id}_{unique_id}.{download.format.value}"
        output_path = os.path.join(base_dir, output_filename)

        print(f"Downloading {download.youtube_url} to {output_path}")

        # 2. Extract and download the video (blocking since Celery workers are sync)
        import yt_dlp

        # Download options
        ydl_opts = {
            # Use format appropriately. If mp4, use best available up to resolution, if mp3 use audio only.
            'format': f'bestvideo[height<={download.quality.strip("p")}]+bestaudio/best' if download.format.value == 'mp4' else 'bestaudio/best',
            'outtmpl': output_path,
            'quiet': True,
            'no_warnings': True,
        }

        # If it's an MP3 format, we might need ffmpeg post processing directly during yt-dlp to convert the downloaded audio container
        if download.format.value == 'mp3':
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([download.youtube_url])

        # yt-dlp renames the file automatically after postprocessing (e.g., test.m4a -> test.mp3)
        # Update progressive status
        download.progress = 50.0
        db.commit()

        # In a real-world scenario with dedicated ffmpeg service:
        # If output_path does not exist or we need custom ffmpeg conversions beyond basic yt-dlp capabilities
        # We would use the services/converter.py module here (using asyncio.run to execute async code in celery sync task)
        # Example processing with ffmpeg wrapper:
        
        # For simplicity, yt-dlp often handles the initial muxing to mp4/webm or extraction to mp3 internally with ffmpeg.
        # But assuming we must use explicit converters based on the previous specifications:
        # We must adjust the filename logic if yt-dlp saved it differently (e.g. .mkv/.webm)

        actual_output_path = output_path
        # If yt-dlp generated an intermediate file without `.mp4`/`.mp3`, we'd scan and process it.
        # But we instructed yt-dlp to save as output_path (which often inherits .webm or .mkv regardless of outtmpl if codecs differ)
        
        # Searching the output_path directory for variations due to yt-dlp suffix changing behaviour 
        # (if outtmpl doesn't strictly match the final extension after container merge)
        import glob
        files_matching_prefix = glob.glob(f"{os.path.join(base_dir, download.video_id)}_{unique_id}.*")
        if files_matching_prefix:
            # yt-dlp creates final files, take the first matching our unique id prefix
            # this avoids missing the file when yt-dlp appends .mp4/mkv/webm/mp3 dynamically.
             raw_file = files_matching_prefix[0]
             
             # If it needs manual conversion to ensure exact requested format
             # If yt-dlp didn't make it exactly MP4 or MP3 (e.g. webm video, m4a audio)
             if download.format.value == 'mp4' and not raw_file.endswith('.mp4'):
                 import asyncio
                 from app.services.converter import convert_to_mp4
                 final_path = os.path.join(base_dir, f"conv_{download.video_id}_{unique_id}.mp4")
                 asyncio.run(convert_to_mp4(raw_file, final_path, download.quality))
                 os.remove(raw_file)
                 actual_output_path = final_path
                 
             elif download.format.value == 'mp3' and not raw_file.endswith('.mp3'):
                 import asyncio
                 from app.services.converter import convert_to_mp3
                 final_path = os.path.join(base_dir, f"conv_{download.video_id}_{unique_id}.mp3")
                 asyncio.run(convert_to_mp3(raw_file, final_path))
                 os.remove(raw_file)
                 actual_output_path = final_path
             else:
                 actual_output_path = raw_file


        # 4. Mark completion
        download.progress = 100.0
        download.status = "completed"
        # We store the absolute file path or relative URL depending on file serving strategy
        download.file_path = actual_output_path
        db.commit()

        print(f"Task completed. File ready at {actual_output_path}")

    except Exception as e:
        print(f"Error converting video {download_id}: {e}")
        db.rollback()
        # Mark as failed
        download = db.query(Download).filter(Download.id == download_id).first()
        if download:
            download.status = "failed"
            download.error_message = str(e)
            db.commit()

    finally:
        db.close()
