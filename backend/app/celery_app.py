from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "portfolio",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.email_tasks",
        "app.tasks.order_tasks",
        "app.tasks.media_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
    beat_schedule={
        # Clean up expired/orphaned media files every 24 hours
        "cleanup-orphaned-media": {
            "task": "app.tasks.media_tasks.cleanup_orphaned_media",
            "schedule": 86400,
        },
        # Cancel stale payment-pending orders every hour
        "cancel-stale-orders": {
            "task": "app.tasks.order_tasks.cancel_stale_orders",
            "schedule": 3600,
        },
    },
)
