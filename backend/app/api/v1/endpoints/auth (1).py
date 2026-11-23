import secrets
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from app.api.deps import DB, CurrentUser
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UpdateProfileRequest, UserResponse
from app.services.email_service import send_verification_email, send_welcome_email

router = APIRouter(prefix="/auth", tags=["auth"])


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


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: DB):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")
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
