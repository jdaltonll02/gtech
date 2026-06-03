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
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_register_duplicate_email():
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
    assert r.status_code == 409
    assert "already registered" in r.json()["detail"]


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
async def test_me_requires_auth():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.get("/api/v1/auth/me")
    assert r.status_code == 403
