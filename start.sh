#!/bin/bash
cd /home/fatlum/Desktop/Projects/youtube-downloader/apps/api
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
