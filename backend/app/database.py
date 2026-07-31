import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    try:
        pg_url = "postgresql://postgres:postgrespassword@localhost:5432/portfolio_command_center"
        test_engine = create_engine(pg_url, connect_args={"connect_timeout": 2})
        with test_engine.connect():
            DATABASE_URL = pg_url
    except Exception:
        DATABASE_URL = "sqlite:///./portfolio.db"

if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
