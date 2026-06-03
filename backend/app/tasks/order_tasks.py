import logging
from app.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30, name="app.tasks.order_tasks.process_paid_order")
def process_paid_order(self, order_id: str) -> dict:
    """Run post-payment processing for an order:
    - Decrement product stock quantities
    - Send order confirmation email
    - Mark order status as PROCESSING
    """
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session
    from app.core.config import settings
    from app.models.ecommerce import Order, OrderStatus, Product
    from app.tasks.email_tasks import send_order_confirmation_task

    try:
        engine = create_engine(settings.DATABASE_URL_SYNC)
        with Session(engine) as db:
            order = db.execute(
                select(Order).where(Order.id == order_id)
            ).scalar_one_or_none()

            if not order:
                logger.error("process_paid_order: order %s not found", order_id)
                return {"status": "not_found", "order_id": order_id}

            items_summary = []
            for item in order.items:
                product = db.execute(
                    select(Product).where(Product.id == item.product_id)
                ).scalar_one_or_none()
                if product and product.stock_quantity > 0:
                    product.stock_quantity = max(0, product.stock_quantity - item.quantity)
                    if product.stock_quantity == 0:
                        product.in_stock = False

                items_summary.append({
                    "name": item.product_name,
                    "quantity": item.quantity,
                    "total": float(item.total_price),
                })

            order.status = OrderStatus.PROCESSING
            db.commit()

        # Fire confirmation email as a separate task
        if order.billing_email:
            send_order_confirmation_task.delay(
                to=order.billing_email,
                full_name=order.billing_name or "Customer",
                order_id=str(order.id),
                total=float(order.total),
                items=items_summary,
            )

        logger.info("process_paid_order: completed for order %s", order_id)
        return {"status": "processed", "order_id": order_id}

    except Exception as exc:
        logger.error("process_paid_order failed for %s: %s", order_id, exc)
        raise self.retry(exc=exc)


@celery_app.task(name="app.tasks.order_tasks.cancel_stale_orders")
def cancel_stale_orders() -> dict:
    """Cancel orders that have been in PAYMENT_PENDING for more than 24 hours."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import create_engine, select
    from sqlalchemy.orm import Session
    from app.core.config import settings
    from app.models.ecommerce import Order, OrderStatus, PaymentStatus

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    engine = create_engine(settings.DATABASE_URL_SYNC)
    cancelled = 0

    with Session(engine) as db:
        stale = db.execute(
            select(Order).where(
                Order.status == OrderStatus.PAYMENT_PENDING,
                Order.payment_status == PaymentStatus.PENDING,
                Order.created_at < cutoff,
            )
        ).scalars().all()

        for order in stale:
            order.status = OrderStatus.CANCELLED
            cancelled += 1

        db.commit()

    logger.info("cancel_stale_orders: cancelled %d orders", cancelled)
    return {"cancelled": cancelled}
