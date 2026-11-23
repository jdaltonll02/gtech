from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import api_router
from fastapi.staticfiles import StaticFiles
import os
from app.core.config import settings
from app.db.session import engine
from app.middleware.rate_limit import limiter
from app.models import *  # noqa: F401,F403 — ensures all models are registered


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing extra needed — Alembic handles migrations
    yield
    # Shutdown: close DB engine
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────


# Serve local media files
media_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "media")
app.mount("/media", StaticFiles(directory=media_dir), name="media")

app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
