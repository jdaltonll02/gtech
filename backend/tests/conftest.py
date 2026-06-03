import uuid
from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.api.deps import get_current_user, get_db
from app.models.user import UserRole


def make_user(role: UserRole = UserRole.USER, **kwargs) -> MagicMock:
    """Return a MagicMock that behaves like a User ORM instance."""
    m = MagicMock()
    m.id = uuid.uuid4()
    m.email = "test@example.com"
    m.full_name = "Test User"
    m.hashed_password = "$2b$12$placeholder"
    m.role = role
    m.is_active = True
    m.is_verified = True
    m.verification_token = None
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


def mock_db_result(value):
    r = MagicMock()
    r.scalar_one_or_none.return_value = value
    return r


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.execute = AsyncMock()
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.delete = AsyncMock()
    db.refresh = AsyncMock()
    return db


@pytest.fixture
def regular_user():
    return make_user()


@pytest.fixture
def admin_user():
    return make_user(role=UserRole.ADMIN, email="admin@example.com")


@pytest.fixture
async def client(mock_db):
    app.dependency_overrides[get_db] = lambda: mock_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_client(mock_db, regular_user):
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: regular_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def admin_client(mock_db, admin_user):
    app.dependency_overrides[get_db] = lambda: mock_db
    app.dependency_overrides[get_current_user] = lambda: admin_user
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
