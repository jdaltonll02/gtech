"""Regression tests for cleanup_orphaned_media (app/tasks/media_tasks.py).

Root cause: LOCAL_MEDIA_ROOT is configured as a relative path ("media"), but
Media.local_path is stored as an absolute path. The orphan-file scan walked
LOCAL_MEDIA_ROOT as-is and compared the resulting relative paths against the
absolute db_paths set, so every real file failed to match and was deleted as
"orphaned" on every scheduled run (every 24h) — this is why uploaded photos
disappeared some time after being uploaded.
"""
import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import Base
from app.models.media import Media
from app.tasks.media_tasks import cleanup_orphaned_media


@pytest.fixture
def sqlite_media_engine(tmp_path, monkeypatch):
    db_path = tmp_path / "media_test.db"
    db_url = f"sqlite:///{db_path}"
    engine = create_engine(db_url)
    Base.metadata.create_all(engine, tables=[Media.__table__])
    monkeypatch.setattr(settings, "DATABASE_URL_SYNC", db_url)
    return engine


def _insert_media(engine, local_path: str, url: str, folder: str = "uploads"):
    with Session(engine) as db:
        db.add(Media(
            id=uuid.uuid4(), filename=local_path.rsplit("/", 1)[-1],
            original_filename="original.jpg", content_type="image/jpeg", size_bytes=16,
            local_path=local_path, url=url, folder=folder, uploaded_by=None,
            created_at=datetime.now(timezone.utc),
        ))
        db.commit()


def test_cleanup_keeps_real_files_with_relative_media_root(tmp_path, sqlite_media_engine, monkeypatch):
    """LOCAL_MEDIA_ROOT is relative in production (settings default: "media"),
    resolved against the process's CWD — reproduce that exactly instead of
    pointing it at an absolute path, or the regression wouldn't be caught."""
    media_root = tmp_path / "media"
    (media_root / "uploads").mkdir(parents=True)
    real_file = media_root / "uploads" / "keep.jpg"
    real_file.write_bytes(b"fake image data")

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(settings, "LOCAL_MEDIA_ROOT", "media")

    _insert_media(sqlite_media_engine, str(real_file), "/media/uploads/keep.jpg")

    result = cleanup_orphaned_media()

    assert result == {"removed_records": 0, "removed_files": 0}
    assert real_file.exists()


def test_cleanup_removes_file_with_no_db_record(tmp_path, sqlite_media_engine, monkeypatch):
    media_root = tmp_path / "media"
    (media_root / "uploads").mkdir(parents=True)
    orphan_file = media_root / "uploads" / "orphan.jpg"
    orphan_file.write_bytes(b"no db record for this one")

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(settings, "LOCAL_MEDIA_ROOT", "media")

    result = cleanup_orphaned_media()

    assert result == {"removed_records": 0, "removed_files": 1}
    assert not orphan_file.exists()


def test_cleanup_removes_db_record_with_no_file(tmp_path, sqlite_media_engine, monkeypatch):
    media_root = tmp_path / "media"
    media_root.mkdir()
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(settings, "LOCAL_MEDIA_ROOT", "media")

    missing_path = str(media_root / "uploads" / "gone.jpg")
    _insert_media(sqlite_media_engine, missing_path, "/media/uploads/gone.jpg")

    result = cleanup_orphaned_media()

    assert result == {"removed_records": 1, "removed_files": 0}
