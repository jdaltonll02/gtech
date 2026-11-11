import uuid
from unittest.mock import AsyncMock, MagicMock
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.api.deps import get_current_user, get_db
from app.models.user import UserRole
import app.db.redis as redis_module


@pytest.fixture(autouse=True)
async def _fresh_redis_client_per_test():
    """app.db.redis caches one global client for the process lifetime, which is
    correct under uvicorn's single persistent event loop but breaks under
    pytest-asyncio's function-scoped loops (the cached client's connection is
    bound to a loop that's already closed by the next test). Reset it so each
    test gets a client bound to its own loop."""
    redis_module._redis = None
    yield
    redis_module._redis = None


def make_user(role: UserRole = UserRole.USER, **kwargs) -> MagicMock:
    """Return a MagicMock that behaves like a User ORM instance.

    Every field the User model actually has is set explicitly — an unset
    MagicMock attribute auto-creates a truthy child Mock, which silently breaks
    any `if user.some_flag:` check (e.g. two_factor_enabled) or response-model
    serialization of an Optional[str] field (e.g. bio) with confusing failures
    far from the real cause.
    """
    m = MagicMock()
    m.id = uuid.uuid4()
    m.email = "test@example.com"
    m.full_name = "Test User"
    m.hashed_password = "$2b$12$placeholder"
    m.role = role
    m.is_active = True
    m.is_verified = True
    m.verification_token = None
    m.two_factor_enabled = False
    m.google_id = None
    for field in ("bio", "headline", "job_title", "company", "school", "phone",
                  "website", "city", "country", "address",
                  "linkedin_url", "twitter_url", "github_url"):
        setattr(m, field, None)
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
