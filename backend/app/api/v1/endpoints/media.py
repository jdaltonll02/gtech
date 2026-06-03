import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.deps import AdminUser, DB
from app.db.session import get_db
from app.models.media import Media
from app.schemas.media import MediaResponse

router = APIRouter(prefix="/media", tags=["media"])

# Optional bearer — does not raise 401 if token is absent
_optional_bearer = HTTPBearer(auto_error=False)


async def _optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_optional_bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional[uuid.UUID]:
    """Return the current user's UUID if a valid token is provided, else None."""
    if not credentials:
        return None
    try:
        from app.core.security import decode_token
        from app.models.user import User
        payload = decode_token(credentials.credentials, expected_type="access")
        user_id = uuid.UUID(payload["sub"])
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        return user.id if user and user.is_active else None
    except Exception:
        return None


@router.post("/upload", response_model=MediaResponse, status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    folder: str = "uploads",
    db: AsyncSession = Depends(get_db),
    uploader_id: Optional[uuid.UUID] = Depends(_optional_user_id),
):
    backend_root = Path(__file__).resolve().parents[4]
    media_dir = backend_root / "media" / folder
    os.makedirs(media_dir, exist_ok=True)

    ext = (file.filename or "file").rsplit(".", 1)[-1].lower()
    unique_name = f"{uuid.uuid4()}.{ext}"
    local_path = str(media_dir / unique_name)

    content = await file.read()
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
        uploaded_by=uploader_id,
    )
    db.add(media)
    await db.flush()
    return media


@router.get("/", response_model=List[MediaResponse])
async def list_media(db: DB, skip: int = 0, limit: int = 50):
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
