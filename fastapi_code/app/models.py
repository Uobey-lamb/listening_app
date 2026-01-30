from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB

class FailedVideo(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    video_id: str = Field(index=True)
    channel: str
    reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Video(SQLModel, table=True):
    video_id: str = Field(primary_key=True)
    channel: str
    language: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Problem(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    video_id: str = Field(index=True)
    context: list[str] = Field(sa_column=Column(JSONB))
    time: list[float] = Field(sa_column=Column(JSONB))
    answer: list[str] = Field(sa_column=Column(JSONB))
    options: list[dict[str, str]] = Field(sa_column=Column(JSONB))
    created_at: datetime = Field(default_factory=datetime.utcnow)