"""Tests for /api/v1/auth endpoints."""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.api.deps import get_db
from app.core.security import hash_password
from app.models.user import User, UserRole
from tests.conftest import make_user, mock_db_result


@pytest.mark.asyncio
async def test_register_success():
    db = AsyncMock()
    db.execute.return_value = mock_db_result(None)  # no existing user
    db.flush = AsyncMock()

    # SQLAlchemy column defaults are applied during flush, not at construction.
    # Simulate that by injecting them when add() is called on the new User instance.
    # db.add is NOT awaited in the endpoint, so it must be a plain MagicMock.
    def _inject_defaults(obj):
        obj.__dict__.update({
            "id": uuid.uuid4(),
            "is_active": True,
            "is_verified": False,
            "role": UserRole.USER,
        })

    db.add = MagicMock(side_effect=_inject_defaults)

    app.dependency_overrides[get_db] = lambda: db

    with patch("app.api.v1.endpoints.auth.send_verification_email", new=AsyncMock()):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/v1/auth/register", json={
                "email": "new@example.com",
                "full_name": "New User",
                "password": "SecurePass1!",
            })

    app.dependency_overrides.clear()
    assert r.status_code == 200
    assert "verification email" in r.json()["message"]


@pytest.mark.asyncio
async def test_register_duplicate_email():
    """Duplicate registration returns the same generic message as a fresh one —
    the endpoint deliberately avoids a 409/distinct response to prevent account
    enumeration (see the comment in auth.register)."""
    existing = make_user(email="dup@example.com")
    db = AsyncMock()
    db.execute.return_value = mock_db_result(existing)

    app.dependency_overrides[get_db] = lambda: db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/auth/register", json={
            "email": "dup@example.com",
            "full_name": "Dup User",
            "password": "SecurePass1!",
        })

    app.dependency_overrides.clear()
    assert r.status_code == 200
    assert "verification email" in r.json()["message"]


@pytest.mark.asyncio
async def test_register_weak_password_rejected():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/auth/register", json={
            "email": "user@example.com",
            "full_name": "Test User",
            "password": "weak",
        })
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_login_success():
    user = make_user(hashed_password=hash_password("correct-password"), role="user")
    db = AsyncMock()
    db.execute.return_value = mock_db_result(user)

    app.dependency_overrides[get_db] = lambda: db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "correct-password",
        })

    app.dependency_overrides.clear()
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password():
    user = make_user(hashed_password=hash_password("correct-password"))
    db = AsyncMock()
    db.execute.return_value = mock_db_result(user)

    app.dependency_overrides[get_db] = lambda: db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "wrong-password",
        })

    app.dependency_overrides.clear()
    assert r.status_code == 401
    assert "Invalid credentials" in r.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_user():
    db = AsyncMock()
    db.execute.return_value = mock_db_result(None)

    app.dependency_overrides[get_db] = lambda: db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/auth/login", json={
            "email": "ghost@example.com",
            "password": "anything1A",
        })

    app.dependency_overrides.clear()
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_login_inactive_account():
    user = make_user(hashed_password=hash_password("pass1A"), is_active=False)
    db = AsyncMock()
    db.execute.return_value = mock_db_result(user)

    app.dependency_overrides[get_db] = lambda: db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "pass1A",
        })

    app.dependency_overrides.clear()
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_refresh_invalid_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post("/api/v1/auth/refresh", json={"refresh_token": "not.a.valid.jwt"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token_is_single_use():
    """A refresh token must be rotated on use — replaying it should fail."""
    from app.core.security import create_refresh_token

    user = make_user()
    db = AsyncMock()
    db.execute.return_value = mock_db_result(user)
    app.dependency_overrides[get_db] = lambda: db

    refresh_token = create_refresh_token(str(user.id))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        first = await c.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        replay = await c.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})

    app.dependency_overrides.clear()
    assert first.status_code == 200
    assert replay.status_code == 401


@pytest.mark.asyncio
async def test_logout_revokes_refresh_token_too():
    """Logging out must invalidate the refresh token, not just the access token."""
    from app.api.deps import get_current_user
    from app.core.security import create_access_token, create_refresh_token

    user = make_user()
    db = AsyncMock()
    db.execute.return_value = mock_db_result(user)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    access_token = create_access_token(str(user.id))
    refresh_token = create_refresh_token(str(user.id))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        logout_r = await c.post(
            "/api/v1/auth/logout",
            headers={"Authorization": f"Bearer {access_token}"},
            json={"refresh_token": refresh_token},
        )
        refresh_after = await c.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})

    app.dependency_overrides.clear()
    assert logout_r.status_code == 200
    assert refresh_after.status_code == 401


@pytest.mark.asyncio
async def test_me_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/auth/me")
    # 401 (not 403) is correct here: no credentials were presented at all,
    # which is what HTTPBearer's default auto_error reports.
    assert r.status_code == 401


# ── Email change requires current_password + forces re-verification ──────────

@pytest.mark.asyncio
async def test_update_email_requires_current_password():
    from app.api.deps import get_current_user

    user = make_user(hashed_password=hash_password("correct-password"), is_verified=True)
    db = AsyncMock()
    db.execute.return_value = mock_db_result(None)  # no conflicting email
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.patch("/api/v1/auth/me", json={"email": "new@example.com"})

    app.dependency_overrides.clear()
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_update_email_rejects_wrong_password():
    from app.api.deps import get_current_user

    user = make_user(hashed_password=hash_password("correct-password"), is_verified=True)
    db = AsyncMock()
    db.execute.return_value = mock_db_result(None)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.patch("/api/v1/auth/me", json={"email": "new@example.com", "current_password": "wrong"})

    app.dependency_overrides.clear()
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_update_email_forces_reverification():
    from app.api.deps import get_current_user

    user = make_user(hashed_password=hash_password("correct-password"), is_verified=True)
    db = AsyncMock()
    db.execute.return_value = mock_db_result(None)
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    with patch("app.api.v1.endpoints.auth.send_verification_email", new=AsyncMock()) as mock_send:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.patch("/api/v1/auth/me", json={"email": "new@example.com", "current_password": "correct-password"})

    app.dependency_overrides.clear()
    assert r.status_code == 200
    assert user.email == "new@example.com"
    assert user.is_verified is False
    mock_send.assert_called_once()
