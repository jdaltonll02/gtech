import hashlib
import random
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from app.api.deps import DB, CurrentUser
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.db.redis import cache_get, cache_set, cache_delete
from app.models.user import User
from app.models.support import PasswordResetToken
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UpdateProfileRequest, UserResponse
from app.services.email_service import send_verification_email, send_welcome_email
import httpx

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Password Reset ────────────────────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password", status_code=200)
async def forgot_password(payload: ForgotPasswordRequest, db: DB):
    result = await db.execute(select(User).where(User.email == str(payload.email)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        return {"message": "If an account exists, a reset link has been sent."}

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    existing = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at == None)
    )
    for old in existing.scalars():
        old.used_at = datetime.now(timezone.utc)

    db.add(PasswordResetToken(user_id=user.id, token_hash=token_hash, expires_at=expires_at))
    await db.flush()

    from app.tasks.email_tasks import send_password_reset_task
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"
    send_password_reset_task.delay(to=user.email, full_name=user.full_name, reset_url=reset_url)
    return {"message": "If an account exists, a reset link has been sent."}


@router.post("/reset-password", status_code=200)
async def reset_password(payload: ResetPasswordRequest, db: DB):
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at == None,
        )
    )
    record = result.scalar_one_or_none()
    if not record or record.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    user_result = await db.execute(select(User).where(User.id == record.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.hashed_password = hash_password(payload.new_password)
    record.used_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Password reset successfully. You can now sign in."}


# ── 2FA (email OTP) ───────────────────────────────────────────────────────────

class TwoFactorVerifyRequest(BaseModel):
    user_id: str
    code: str


@router.post("/2fa/send-code", status_code=200)
async def send_2fa_code_endpoint(db: DB, current_user: CurrentUser):
    code = f"{random.randint(0, 999999):06d}"
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    await cache_set(f"2fa:{current_user.id}", code_hash, ttl=600)
    from app.tasks.email_tasks import send_2fa_code_task
    send_2fa_code_task.delay(to=current_user.email, full_name=current_user.full_name, code=code)
    email = current_user.email
    hint = f"{email[:2]}***@{email.split('@')[1]}"
    return {"message": "Code sent.", "hint": hint}


@router.post("/2fa/verify", response_model=TokenResponse)
async def verify_2fa(payload: TwoFactorVerifyRequest, db: DB):
    stored_hash = await cache_get(f"2fa:{payload.user_id}")
    if not stored_hash:
        raise HTTPException(status_code=400, detail="Code expired or not found. Request a new one.")
    if hashlib.sha256(payload.code.encode()).hexdigest() != stored_hash:
        raise HTTPException(status_code=400, detail="Invalid verification code.")
    await cache_delete(f"2fa:{payload.user_id}")
    return TokenResponse(
        access_token=create_access_token(payload.user_id),
        refresh_token=create_refresh_token(payload.user_id),
    )


@router.post("/2fa/enable", status_code=200)
async def enable_2fa(db: DB, current_user: CurrentUser):
    current_user.two_factor_enabled = True
    await db.flush()
    return {"message": "Two-factor authentication enabled."}


@router.post("/2fa/disable", status_code=200)
async def disable_2fa(db: DB, current_user: CurrentUser):
    current_user.two_factor_enabled = False
    await cache_delete(f"2fa:{current_user.id}")
    await db.flush()
    return {"message": "Two-factor authentication disabled."}


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: DB):
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    token = secrets.token_urlsafe(32)
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        verification_token=token,
    )
    db.add(user)
    await db.flush()
    # Send verification email (non-blocking — failure doesn’t break registration)
    await send_verification_email(user.email, user.full_name, token)
    return user


@router.post("/login")
async def login(payload: LoginRequest, db: DB):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    # If 2FA is enabled, generate and send an OTP instead of returning tokens
    if user.two_factor_enabled:
        code = f"{random.randint(0, 999999):06d}"
        code_hash = hashlib.sha256(code.encode()).hexdigest()
        await cache_set(f"2fa:{user.id}", code_hash, ttl=600)
        from app.tasks.email_tasks import send_2fa_code_task
        send_2fa_code_task.delay(to=user.email, full_name=user.full_name, code=code)
        email = user.email
        hint = f"{email[:2]}***@{email.split('@')[1]}"
        return {
            "requires_2fa": True,
            "user_id": str(user.id),
            "hint": hint,
        }

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, db: DB):
    token_data = decode_token(payload.refresh_token, expected_type="refresh")
    result = await db.execute(select(User).where(User.id == token_data["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(payload: UpdateProfileRequest, current_user: CurrentUser, db: DB):
    if payload.new_password:
        if not payload.current_password:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="current_password is required to set a new password")
        if not verify_password(payload.current_password, current_user.hashed_password):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
        current_user.hashed_password = hash_password(payload.new_password)

    if payload.email and payload.email != current_user.email:
        existing = await db.execute(select(User).where(User.email == payload.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")
        current_user.email = payload.email

    if payload.full_name:
        current_user.full_name = payload.full_name

    await db.flush()
    return current_user


@router.post("/verify-email", status_code=200)
async def verify_email(token: str, db: DB):
    """Verify a user's email address using the token sent during registration."""
    result = await db.execute(select(User).where(User.verification_token == token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
    if user.is_verified:
        return {"message": "Email already verified"}
    user.is_verified = True
    user.verification_token = None
    await db.flush()
    await send_welcome_email(user.email, user.full_name)
    return {"message": "Email verified successfully"}


@router.post("/resend-verification", status_code=200)
async def resend_verification(current_user: CurrentUser, db: DB):
    """Resend the verification email to the currently logged-in user."""
    if current_user.is_verified:
        return {"message": "Email already verified"}
    token = secrets.token_urlsafe(32)
    current_user.verification_token = token
    await db.flush()
    await send_verification_email(current_user.email, current_user.full_name, token)
    return {"message": "Verification email sent"}


_GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google")
async def google_login():
    """Redirect the browser to Google's OAuth consent screen."""
    params = (
        f"?client_id={settings.GOOGLE_CLIENT_ID}"
        f"&redirect_uri={settings.GOOGLE_REDIRECT_URI}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        "&prompt=consent"
    )
    return RedirectResponse(_GOOGLE_AUTH_URL + params)


@router.get("/google/callback")
async def google_callback(code: str, db: DB):
    """Exchange the Google auth code for tokens, upsert the user, return JWT tokens."""
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_resp = await client.post(_GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        token_resp.raise_for_status()
        google_access_token = token_resp.json()["access_token"]

        # Fetch user info
        info_resp = await client.get(_GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {google_access_token}"})
        info_resp.raise_for_status()
        info = info_resp.json()

    google_id = info["sub"]
    email = info["email"]
    full_name = info.get("name", email.split("@")[0])

    # Upsert user
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user:
        user.google_id = google_id
        user.is_verified = True
    else:
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hash_password(secrets.token_hex(16)),
            google_id=google_id,
            is_verified=True,
        )
        db.add(user)

    await db.flush()

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))
    frontend_url = settings.FRONTEND_URL
    return RedirectResponse(
        f"{frontend_url}/login?access_token={access_token}&refresh_token={refresh_token}"
    )
