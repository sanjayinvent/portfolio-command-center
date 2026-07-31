from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api.routes import router

# Create database tables automatically on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Portfolio Command Center V2 Intranet API",
    description="Python FastAPI 3-Tier Microservice for Portfolio Management & Options Strategy Engine",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for Intranet Web Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

@app.get("/")
def read_root():
    return {
        "message": "Welcome to Portfolio Command Center V2 Intranet API",
        "docs": "/docs",
        "health": "/api/v1/health"
    }
