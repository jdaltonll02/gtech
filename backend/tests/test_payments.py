"""Tests for /api/v1/payments endpoints — security fixes and PayPal task dispatch."""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.api.deps import get_db, get_current_user
from app.models.ecommerce import OrderStatus, PaymentProvider, PaymentStatus
from app.core.config import settings
from tests.conftest import make_user, mock_db_result


def _make_order(**kwargs) -> MagicMock:
    m = MagicMock()
    m.id = uuid.uuid4()
    m.user_id = uuid.uuid4()
    m.status = OrderStatus.PAYMENT_PENDING
    m.payment_status = PaymentStatus.PENDING
    m.subtotal = 100
    m.tax = 8
    m.total = 108
    m.payment_provider = PaymentProvider.MOMO
    m.payment_reference = "ref-abc123"
    m.billing_email = "buyer@example.com"
    m.billing_name = "Test Buyer"
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


# ── MOMO callback security ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_momo_callback_rejects_wrong_secret(monkeypatch):
    monkeypatch.setattr(settings, "MOMO_CALLBACK_SECRET", "correct-secret")

    db = AsyncMock()
    app.dependency_overrides[get_db] = lambda: db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/v1/payments/momo/callback?secret=wrong-secret",
            json={"externalId": "order-ref-123"},
        )

    app.dependency_overrides.clear()
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_momo_callback_accepts_correct_secret(monkeypatch):
    monkeypatch.setattr(settings, "MOMO_CALLBACK_SECRET", "correct-secret")

    order = _make_order(payment_reference="order-ref-123")
    db = AsyncMock()
    db.execute.return_value = mock_db_result(order)

    app.dependency_overrides[get_db] = lambda: db

    with patch(
        "app.api.v1.endpoints.payments.momo_service.get_transaction_status",
        new=AsyncMock(return_value={"status": "PENDING"}),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/v1/payments/momo/callback?secret=correct-secret",
                json={"externalId": "order-ref-123"},
            )

    app.dependency_overrides.clear()
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_momo_callback_no_secret_configured_accepts_all(monkeypatch):
    """When MOMO_CALLBACK_SECRET is empty, the secret check is skipped."""
    monkeypatch.setattr(settings, "MOMO_CALLBACK_SECRET", "")

    db = AsyncMock()
    db.execute.return_value = mock_db_result(None)

    app.dependency_overrides[get_db] = lambda: db

    with patch(
        "app.api.v1.endpoints.payments.momo_service.get_transaction_status",
        new=AsyncMock(return_value={"status": "PENDING"}),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/v1/payments/momo/callback",
                json={"externalId": "any-ref"},
            )

    app.dependency_overrides.clear()
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_momo_callback_marks_order_paid_on_successful_status(monkeypatch):
    monkeypatch.setattr(settings, "MOMO_CALLBACK_SECRET", "")

    order = _make_order(payment_reference="ref-success")
    db = AsyncMock()
    db.execute.return_value = mock_db_result(order)

    app.dependency_overrides[get_db] = lambda: db

    with patch(
        "app.api.v1.endpoints.payments.momo_service.get_transaction_status",
        new=AsyncMock(return_value={"status": "SUCCESSFUL"}),
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post(
                "/api/v1/payments/momo/callback",
                json={"externalId": "ref-success"},
            )

    app.dependency_overrides.clear()
    assert r.status_code == 200
    assert order.payment_status == PaymentStatus.COMPLETED
    assert order.status == OrderStatus.PAID


# ── Stripe webhook rejects bad signatures ─────────────────────────────────────

@pytest.mark.asyncio
async def test_stripe_webhook_rejects_bad_signature():
    db = AsyncMock()
    app.dependency_overrides[get_db] = lambda: db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        r = await c.post(
            "/api/v1/payments/stripe/webhook",
            content=b'{"type": "payment_intent.succeeded"}',
            headers={"stripe-signature": "bad-sig"},
        )

    app.dependency_overrides.clear()
    assert r.status_code == 400


# ── PayPal capture dispatches fulfillment task ────────────────────────────────

@pytest.mark.asyncio
async def test_paypal_capture_dispatches_process_order():
    user = make_user()
    order = _make_order(user_id=user.id, payment_reference="paypal-order-id-xyz")

    db = AsyncMock()
    db.execute.return_value = mock_db_result(order)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    with (
        patch(
            "app.api.v1.endpoints.payments.paypal_service.capture_order",
            new=AsyncMock(return_value={"status": "COMPLETED"}),
        ),
        patch("app.tasks.order_tasks.process_paid_order") as mock_task,
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/v1/payments/paypal/capture/paypal-order-id-xyz")

    app.dependency_overrides.clear()
    assert r.status_code == 200
    mock_task.delay.assert_called_once_with(str(order.id))


@pytest.mark.asyncio
async def test_paypal_capture_no_task_on_non_completed():
    user = make_user()
    order = _make_order(user_id=user.id, payment_reference="paypal-order-pending")

    db = AsyncMock()
    db.execute.return_value = mock_db_result(order)

    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_current_user] = lambda: user

    with (
        patch(
            "app.api.v1.endpoints.payments.paypal_service.capture_order",
            new=AsyncMock(return_value={"status": "PENDING"}),
        ),
        patch("app.tasks.order_tasks.process_paid_order") as mock_task,
    ):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            r = await c.post("/api/v1/payments/paypal/capture/paypal-order-pending")

    app.dependency_overrides.clear()
    assert r.status_code == 200
    mock_task.delay.assert_not_called()
