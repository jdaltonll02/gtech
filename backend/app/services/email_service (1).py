import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)


async def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send an email. Returns True on success, False if SMTP not configured or on error."""
    if not _smtp_configured():
        logger.warning("SMTP not configured — skipping email to %s: %s", to, subject)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(msg["From"], [to], msg.as_string())
        return True
    except Exception as e:
        logger.error("Failed to send email to %s: %s", to, e)
        return False


async def send_verification_email(to: str, full_name: str, token: str) -> bool:
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#8B0000">Verify your email</h2>
      <p>Hi {full_name},</p>
      <p>Click the button below to verify your email address.</p>
      <a href="{verify_url}"
         style="display:inline-block;background:#8B0000;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;margin:16px 0">
        Verify Email
      </a>
      <p style="color:#666;font-size:13px">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
    </div>
    """
    return await send_email(to, "Verify your email address", html)


async def send_welcome_email(to: str, full_name: str) -> bool:
    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
      <h2 style="color:#8B0000">Welcome, {full_name}!</h2>
      <p>Your account has been verified. You can now sign in and start exploring.</p>
      <a href="{settings.FRONTEND_URL}/login"
         style="display:inline-block;background:#8B0000;color:#fff;padding:12px 24px;
                border-radius:8px;text-decoration:none;margin:16px 0">
        Sign In
      </a>
    </div>
    """
    return await send_email(to, "Welcome! Your account is ready", html)
