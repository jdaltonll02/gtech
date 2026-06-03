import logging
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

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup checks
    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD):
        logger.warning(
            "SMTP is not configured (SMTP_HOST / SMTP_USER / SMTP_PASSWORD are missing). "
            "Email verification and transactional emails will be silently skipped."
        )
    yield
    # Shutdown: close DB engine
    await engine.dispose()


_is_prod = settings.ENVIRONMENT == "production"

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

# ── Routes ────────────────────────────────────────────────────────────────────


# Serve local media files
media_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "media")
app.mount("/media", StaticFiles(directory=media_dir), name="media")

app.include_router(api_router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
