import os
import time
from sqlmodel import create_engine, SQLModel
from sqlalchemy.exc import OperationalError

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@db:5432/listening"
)

engine = create_engine(DATABASE_URL, echo=True)

def init_db(
    retries: int = 10,
    delay: float = 1.5,
):
    import app.models

    last_error = None

    for i in range(retries):
        try:
            SQLModel.metadata.create_all(engine)
            print("✅ Database connected and tables created")
            return
        except OperationalError as e:
            last_error = e
            print(f"⏳ DB not ready ({i+1}/{retries}), retrying...")
            time.sleep(delay)

    raise RuntimeError(
        "❌ Could not connect to database after retries"
    ) from last_error
