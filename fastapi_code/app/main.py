import os
import re
import uuid
import random
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled
from xml.etree.ElementTree import ParseError

from app.db import engine, init_db
from app.models import FailedVideo, Video, Problem

app = FastAPI()
ytt_api = YouTubeTranscriptApi()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 設定 ---
RETRY_AFTER = timedelta(days=1)

MY_API_KEY = os.getenv("YOUTUBE_API_KEY")
if not MY_API_KEY:
    raise RuntimeError("APIキーがセットされていません")

# 現在 TED-Ed
YOUTUBE_CHANNEL_ID = 'UCsooa4yRKGN_zEE8iknghZA' 
# --- ここまで ---

youtube = build('youtube', 'v3', developerKey=MY_API_KEY)

# 動画取得関数
def fetch_and_store_videos(channel_id: str, max_results: int = 50):
    res = youtube.search().list(
        part="id",
        channelId=channel_id,
        order="date",
        maxResults=max_results,
        type="video"
    ).execute()

    video_ids = [
        item["id"]["videoId"]
        for item in res.get("items", [])
        if "videoId" in item["id"]
    ]

    with Session(engine) as session:
        for vid in video_ids:
            if not session.get(Video, vid):
                session.add(
                    Video(
                        video_id=vid,
                        channel=channel_id,
                        language=None,
                    )
                )
        session.commit()
    print(f"✅ Stored {len(video_ids)} videos")

# 字幕取得
def fetch_best_english_transcript(video_id: str):
    try:
        transcript_obj = ytt_api.fetch(video_id, languages=["en", "en-GB"])

        transcript = transcript_obj.to_raw_data()

        return transcript, {
            "language_code": transcript_obj.language_code,
            "is_generated": transcript_obj.is_generated
        }

    except (NoTranscriptFound, TranscriptsDisabled):
        return None, None

# 調整
def clean_transcript(transcript: list[dict]) -> list[dict]:
    cleaned = []

    for item in transcript:
        text = item["text"].replace("\n", " ").strip()

        if text.startswith("[") and text.endswith("]"):
            continue
        if len(text.split()) < 4:
            continue
    
        cleaned.append({
            "start": item["start"],
            "duration": item["duration"],
            "text": text
        })

    return cleaned

# 虫食い問題形式への調整
def generate_problem(transcript_list, min_words=4):
    transcript = []
    transcript_time = []
    for t in transcript_list:
        transcript.append(t["text"])
        transcript_time.append([t["start"], t["duration"]])

    if len(transcript) < 3:
        return None
    
    start_idx = random.randint(1, len(transcript)-4)
    window = transcript[start_idx:start_idx+3]
    window_time = transcript_time[start_idx:start_idx+3]
    
    blank_sentence = window[1]
    words = blank_sentence.split(" ")

    if len(words) < min_words:
        return None
    
    shuffled_words = words.copy()
    random.shuffle(shuffled_words)

    options = [
        {
            "id": str(uuid.uuid4()),
            "word": w
        }
        for w in shuffled_words
    ]

    return {
        "context": [window[0], "_____", window[2]],
        "time": [window_time[0][0]-1.0, window_time[2][0]+window_time[2][1]+1.0],
        "answer": words,
        "options": options
    }

def store_problem() -> bool:
    with Session(engine) as session:
        cutoff = datetime.utcnow() - RETRY_AFTER

        failed_ids = {
            row for row in session.exec(
                select(FailedVideo.video_id)
                .where(FailedVideo.created_at > cutoff)
                .distinct()
            )
        }

        video_ids = session.exec(
            select(Video.video_id)
        ).all()
        video_ids = [vid for vid in video_ids if vid not in failed_ids]

        random.shuffle(video_ids)

        for video_id in video_ids:
            try:
                transcript, meta = fetch_best_english_transcript(video_id)
                if not transcript:
                    raise ValueError("No English transcript")

                cleaned = clean_transcript(transcript)
                if len(cleaned) < 3:
                    raise ValueError("Too few segments")

                problem = generate_problem(cleaned)
                if not problem:
                    raise ValueError("Problem generation failed")

                session.add(
                    Problem(
                        video_id=video_id,
                        context=problem["context"],
                        time=problem["time"],
                        answer=problem["answer"],
                        options=problem["options"],
                    )
                )
                session.commit()
                print("✅ problem created")
                return True

            except Exception as e:
                session.add(
                    FailedVideo(
                        video_id=video_id,
                        channel=YOUTUBE_CHANNEL_ID,
                        reason=str(e),
                    )
                )
                session.commit()
                continue

        return False

@app.on_event("startup")
def on_startup():
    init_db()

    with Session(engine) as session:
        has_video = session.exec(select(Video).limit(1)).first()
        has_problem = session.exec(select(Problem).limit(1)).first()
    
    if not has_video:
        print("ℹ️ No videos found, fetching from YouTube...")
        fetch_and_store_videos(YOUTUBE_CHANNEL_ID)

    if not has_problem:
        print("ℹ️ No problem found, generating initial problem...")
        try:
            store_problem()
        except Exception as e:
            print(f"⚠️ Initial problem generation failed: {e}")

@app.post("/problem/generate")
async def generate_problem_endpoint():
    store_problem()
    return {"status": "ok"}

@app.get("/problem")
async def get_problem():
    with Session(engine) as session:
        problem = session.exec(
            select(Problem)
            .order_by(Problem.created_at.desc())
            .limit(1)
        ).first()
        
        if not problem:
            raise HTTPException(
                status_code=404,
                detail="問題がまだ生成されていません"
            )
        
        return {
            "problem_id": problem.id,
            "video_id": problem.video_id,
            "context": problem.context,
            "time": problem.time,
            "options": problem.options,
            "answer": problem.answer
        }