import logging
from app.celery_app import celery_app
from app.services.email_service import send_email, send_verification_email, send_welcome_email

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.email_tasks.send_verification_email_task")
def send_verification_email_task(self, to: str, full_name: str, token: str) -> bool:
    """Send email verification asynchronously with automatic retry on failure."""
    import asyncio
    try:
        result = asyncio.run(send_verification_email(to, full_name, token))
        if not result:
            raise RuntimeError("Email send returned False")
        return True
    except Exception as exc:
        logger.warning("Verification email failed for %s (attempt %d): %s", to, self.request.retries + 1, exc)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.email_tasks.send_welcome_email_task")
def send_welcome_email_task(self, to: str, full_name: str) -> bool:
    """Send welcome email asynchronously."""
    import asyncio
    try:
        result = asyncio.run(send_welcome_email(to, full_name))
        if not result:
            raise RuntimeError("Email send returned False")
        return True
    except Exception as exc:
        logger.warning("Welcome email failed for %s (attempt %d): %s", to, self.request.retries + 1, exc)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.email_tasks.send_order_confirmation_task")
def send_order_confirmation_task(self, to: str, full_name: str, order_id: str, total: float, items: list[dict]) -> bool:
    """Send order confirmation email after successful payment."""
    import asyncio
    from app.core.config import settings

    items_html = "".join(
        f"<tr><td style='padding:4px 8px'>{item['name']}</td>"
        f"<td style='padding:4px 8px'>x{item['quantity']}</td>"
        f"<td style='padding:4px 8px'>${item['total']:.2f}</td></tr>"
        for item in items
    )
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#8B0000">Order Confirmed!</h2>
      <p>Hi {full_name}, thank you for your order.</p>
      <p><strong>Order ID:</strong> {order_id}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="padding:4px 8px;text-align:left">Item</th>
            <th style="padding:4px 8px;text-align:left">Qty</th>
            <th style="padding:4px 8px;text-align:left">Total</th>
          </tr>
        </thead>
        <tbody>{items_html}</tbody>
      </table>
      <p><strong>Order Total: ${total:.2f}</strong></p>
      <a href="{settings.FRONTEND_URL}/orders"
         style="display:inline-block;background:#8B0000;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;margin-top:16px">
        View Order
      </a>
    </div>
    """
    try:
        result = asyncio.run(send_email(to, f"Order Confirmed – #{order_id[:8].upper()}", html))
        if not result:
            raise RuntimeError("Email send returned False")
        return True
    except Exception as exc:
        logger.warning("Order confirmation email failed for %s: %s", to, exc)
        raise self.retry(exc=exc)
