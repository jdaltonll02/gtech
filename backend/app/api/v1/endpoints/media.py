import os
import re
import shutil
import uuid
from pathlib import Path
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, CurrentUser, DB
from app.db.session import get_db
from app.models.media import Media
from app.models.user import UserRole
from app.schemas.media import MediaResponse

router = APIRouter(prefix="/media", tags=["media"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB

ALLOWED_EXTENSIONS = {
    "jpg", "jpeg", "png", "gif", "webp", "svg",  # images
    "pdf", "doc", "docx",                          # documents
    "mp4", "webm", "mov",                          # video
    "mp3", "wav",                                  # audio
    "zip",                                         # archives
}

# Folders any authenticated user may write to
_USER_FOLDERS = frozenset({"uploads", "profile", "resumes"})
# Folders restricted to admin/superadmin
_ADMIN_FOLDERS = frozenset({"courses", "team", "gallery", "products", "course-content", "blog"})

# Only these exact values are accepted for the `folder` query param
_AllowedFolder = Literal[
    "uploads", "profile", "courses", "resumes", "team",
    "gallery", "products", "course-content", "blog",
]

# Magic-byte signatures for common binary types
_MAGIC = {
    "jpg":  b"\xff\xd8\xff",
    "jpeg": b"\xff\xd8\xff",
    "png":  b"\x89PNG",
    "gif":  b"GIF8",
    "pdf":  b"%PDF",
}


def _validate_content(ext: str, content: bytes) -> bytes:
    """Validate magic bytes and sanitize SVGs. Returns (possibly modified) content."""
    sig = _MAGIC.get(ext)
    if sig and not content.startswith(sig):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File content does not match its declared extension.",
        )
    if ext == "svg":
        # Strip <script> blocks and event-handler attributes
        content = re.sub(rb"<script[^>]*>.*?</script>", b"", content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(rb"\s+on\w+\s*=\s*[\"'][^\"']*[\"']", b"", content, flags=re.IGNORECASE)
        content = re.sub(rb"\s+on\w+\s*=\s*\S+", b"", content, flags=re.IGNORECASE)
    return content


@router.post("/upload", response_model=MediaResponse, status_code=201)
async def upload_file(
    current_user: CurrentUser,
    file: UploadFile = File(...),
    folder: _AllowedFolder = "uploads",
    db: AsyncSession = Depends(get_db),
):
    # Enforce per-folder permission: only admins may write to content/team folders
    if folder in _ADMIN_FOLDERS and current_user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required for this folder.",
        )

    ext = (file.filename or "file").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '.{ext}' is not allowed.",
        )

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
        )

    content = _validate_content(ext, content)

    backend_root = Path(__file__).resolve().parents[4]
    media_dir = backend_root / "media" / folder
    os.makedirs(media_dir, exist_ok=True)

    unique_name = f"{uuid.uuid4()}.{ext}"
    local_path = str(media_dir / unique_name)

    with open(local_path, "wb") as f:
        f.write(content)

    url = f"/media/{folder}/{unique_name}"
    media = Media(
        filename=unique_name,
        original_filename=file.filename or unique_name,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        local_path=local_path,
        url=url,
        folder=folder,
        uploaded_by=current_user.id,
    )
    db.add(media)
    await db.flush()
    return media


@router.get("/", response_model=List[MediaResponse])
async def list_media(db: DB, _: AdminUser, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(Media).order_by(Media.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/{media_id}", response_model=MediaResponse)
async def get_media(media_id: uuid.UUID, db: DB):
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    return media


@router.delete("/{media_id}", status_code=204)
async def delete_media(media_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Media).where(Media.id == media_id))
    media = result.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    try:
        os.remove(media.local_path)
    except Exception:
        pass
    await db.delete(media)


@router.post("/migrate-legacy", status_code=200)
async def migrate_legacy_media(db: DB, _: AdminUser):
    """One-time migration for files previously written to backend/app/api/media."""
    backend_root = Path(__file__).resolve().parents[4]
    legacy_root = backend_root / "app" / "api" / "media"
    target_root = backend_root / "media"

    if not legacy_root.exists():
        return {
            "moved_files": 0,
            "updated_rows": 0,
            "missing_sources": 0,
            "detail": "Legacy media directory not found; nothing to migrate.",
        }

    moved_files = 0
    updated_rows = 0
    missing_sources = 0

    result = await db.execute(select(Media))
    all_media = result.scalars().all()

    for media in all_media:
        old_path = Path(media.local_path)
        if not str(old_path).startswith(str(legacy_root)):
            continue
        try:
            rel = old_path.relative_to(legacy_root)
        except ValueError:
            continue
        new_path = target_root / rel
        new_path.parent.mkdir(parents=True, exist_ok=True)
        if old_path.exists() and not new_path.exists():
            shutil.move(str(old_path), str(new_path))
            moved_files += 1
        elif not old_path.exists() and not new_path.exists():
            missing_sources += 1
            continue
        media.local_path = str(new_path)
        updated_rows += 1

    await db.flush()
    return {
        "moved_files": moved_files,
        "updated_rows": updated_rows,
        "missing_sources": missing_sources,
        "detail": "Legacy media migration completed.",
    }
