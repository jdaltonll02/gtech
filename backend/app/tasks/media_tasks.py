import logging
import os
from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.tasks.media_tasks.process_uploaded_image")
def process_uploaded_image(media_id: str, local_path: str) -> dict:
    """Resize an uploaded image to web-safe dimensions and overwrite in place."""
    from app.utils.image import resize_image

    try:
        with open(local_path, "rb") as f:
            data = f.read()

        processed = resize_image(data, max_width=1920, max_height=1080, quality=85, output_format="WEBP")

        # Replace original with processed version
        with open(local_path, "wb") as f:
            f.write(processed)

        logger.info("process_uploaded_image: resized media %s (%d bytes)", media_id, len(processed))
        return {"media_id": media_id, "size_bytes": len(processed), "status": "processed"}

    except Exception as exc:
        logger.error("process_uploaded_image failed for %s: %s", media_id, exc)
        return {"media_id": media_id, "status": "failed", "error": str(exc)}


@celery_app.task(name="app.tasks.media_tasks.cleanup_orphaned_media")
def cleanup_orphaned_media() -> dict:
    """Delete media DB records whose local files no longer exist, and remove
    local files that have no corresponding DB record."""
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session
    from app.core.config import settings
    from app.models.media import Media

    engine = create_engine(settings.DATABASE_URL_SYNC)
    removed_records = 0
    removed_files = 0

    with Session(engine) as db:
        # Remove DB records for missing files
        all_media = db.execute(select(Media)).scalars().all()
        for media in all_media:
            if not os.path.exists(media.local_path):
                db.delete(media)
                removed_records += 1
        db.commit()

        # Find files on disk with no DB record
        media_root = settings.LOCAL_MEDIA_ROOT
        if os.path.isdir(media_root):
            db_paths = {m.local_path for m in db.execute(select(Media)).scalars().all()}
            for dirpath, _, filenames in os.walk(media_root):
                for fname in filenames:
                    full_path = os.path.join(dirpath, fname)
                    if full_path not in db_paths:
                        try:
                            os.remove(full_path)
                            removed_files += 1
                        except OSError as e:
                            logger.warning("Could not remove orphaned file %s: %s", full_path, e)

    logger.info(
        "cleanup_orphaned_media: removed %d DB records, %d orphaned files",
        removed_records, removed_files,
    )
    return {"removed_records": removed_records, "removed_files": removed_files}
