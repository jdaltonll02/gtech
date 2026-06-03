import asyncio
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


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.email_tasks.send_password_reset_task")
def send_password_reset_task(self, to: str, full_name: str, reset_url: str) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#8B0000">Reset your password</h2>
      <p>Hi {full_name},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one.</p>
      <a href="{reset_url}"
         style="display:inline-block;background:#8B0000;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;margin:16px 0">
        Reset Password
      </a>
      <p style="color:#666;font-size:13px">This link expires in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email.</p>
    </div>
    """
    try:
        result = asyncio.run(send_email(to, "Reset your password", html))
        if not result:
            raise RuntimeError("Email send returned False")
        return True
    except Exception as exc:
        logger.warning("Password reset email failed for %s: %s", to, exc)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.email_tasks.send_2fa_code_task")
def send_2fa_code_task(self, to: str, full_name: str, code: str) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#8B0000">Your verification code</h2>
      <p>Hi {full_name},</p>
      <p>Use this code to complete your sign-in. It expires in <strong>10 minutes</strong>.</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#8B0000;
                  background:#fdf2f2;border:2px solid #8B0000;border-radius:8px;
                  padding:16px 24px;text-align:center;margin:24px 0">
        {code}
      </div>
      <p style="color:#666;font-size:13px">If you didn't attempt to sign in, please secure your account immediately.</p>
    </div>
    """
    try:
        result = asyncio.run(send_email(to, f"Your sign-in code: {code}", html))
        if not result:
            raise RuntimeError("Email send returned False")
        return True
    except Exception as exc:
        logger.warning("2FA code email failed for %s: %s", to, exc)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.email_tasks.send_ticket_notification_task")
def send_ticket_notification_task(self, ticket_number: str, subject: str, name: str, email: str, category: str, message: str) -> bool:
    from app.core.config import settings
    # 1. Confirmation to user
    user_html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#8B0000">Support Ticket Received</h2>
      <p>Hi {name},</p>
      <p>We've received your support request and will respond within 24 hours.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:6px;color:#666;width:120px">Ticket #</td><td style="padding:6px;font-weight:bold">{ticket_number}</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:6px;color:#666">Subject</td><td style="padding:6px">{subject}</td></tr>
        <tr><td style="padding:6px;color:#666">Category</td><td style="padding:6px;text-transform:capitalize">{category}</td></tr>
      </table>
      <p style="color:#666;font-size:14px">Your message:</p>
      <blockquote style="border-left:3px solid #8B0000;margin:0;padding:8px 16px;color:#444;font-size:14px">{message}</blockquote>
      <a href="{settings.FRONTEND_URL}/tickets"
         style="display:inline-block;background:#8B0000;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;margin-top:24px">
        View Ticket
      </a>
    </div>
    """
    # 2. Admin notification
    admin_html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#8B0000">New Support Ticket: {ticket_number}</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr><td style="padding:6px;color:#666;width:120px">From</td><td style="padding:6px">{name} &lt;{email}&gt;</td></tr>
        <tr style="background:#f9f9f9"><td style="padding:6px;color:#666">Subject</td><td style="padding:6px">{subject}</td></tr>
        <tr><td style="padding:6px;color:#666">Category</td><td style="padding:6px;text-transform:capitalize">{category}</td></tr>
      </table>
      <p style="color:#666;font-size:14px">Message:</p>
      <blockquote style="border-left:3px solid #8B0000;margin:0;padding:8px 16px;color:#444;font-size:14px">{message}</blockquote>
      <a href="{settings.FRONTEND_URL}/admin"
         style="display:inline-block;background:#8B0000;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;margin-top:24px">
        Open Admin Panel
      </a>
    </div>
    """
    try:
        asyncio.run(send_email(email, f"[{ticket_number}] Support ticket received", user_html))
        admin_email = settings.FIRST_SUPERADMIN_EMAIL
        if admin_email:
            asyncio.run(send_email(admin_email, f"[New Ticket] {ticket_number}: {subject}", admin_html))
        return True
    except Exception as exc:
        logger.warning("Ticket notification failed: %s", exc)
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60, name="app.tasks.email_tasks.send_ticket_reply_task")
def send_ticket_reply_task(self, ticket_number: str, subject: str, recipient_email: str, recipient_name: str, reply_content: str, is_admin_reply: bool) -> bool:
    from app.core.config import settings
    sender = "Support Team" if is_admin_reply else recipient_name
    heading = "You have a reply from our support team" if is_admin_reply else "Your customer replied"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px">
      <h2 style="color:#8B0000">Re: [{ticket_number}] {subject}</h2>
      <p>{heading}:</p>
      <blockquote style="border-left:3px solid #8B0000;margin:12px 0;padding:8px 16px;color:#444;font-size:14px">{reply_content}</blockquote>
      <a href="{settings.FRONTEND_URL}/tickets"
         style="display:inline-block;background:#8B0000;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;margin-top:24px">
        View Ticket Thread
      </a>
    </div>
    """
    try:
        result = asyncio.run(send_email(recipient_email, f"Re: [{ticket_number}] {subject}", html))
        if not result:
            raise RuntimeError("Email send returned False")
        return True
    except Exception as exc:
        logger.warning("Ticket reply email failed: %s", exc)
        raise self.retry(exc=exc)
