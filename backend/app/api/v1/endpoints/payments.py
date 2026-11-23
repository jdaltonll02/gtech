import hmac
import uuid
from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.api.deps import CurrentUser, DB
from app.core.config import settings
from app.models.ecommerce import Order, OrderStatus, PaymentProvider, PaymentStatus
from app.schemas.ecommerce import CheckoutRequest, PaymentIntentResponse
from app.services import stripe_service, paypal_service, momo_service

router = APIRouter(prefix="/payments", tags=["payments"])


async def _get_pending_order(order_id: uuid.UUID, user_id: uuid.UUID, db) -> Order:
    result = await db.execute(
        select(Order).options(selectinload(Order.items))
        .where(Order.id == order_id, Order.user_id == user_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.payment_status == PaymentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Order already paid")
    return order


# ── Stripe ────────────────────────────────────────────────────────────────────

@router.post("/stripe/intent/{order_id}", response_model=PaymentIntentResponse)
async def stripe_create_intent(order_id: uuid.UUID, db: DB, current_user: CurrentUser):
    order = await _get_pending_order(order_id, current_user.id, db)
    result = await stripe_service.create_payment_intent(
        amount=order.total,
        metadata={"order_id": str(order.id), "user_id": str(current_user.id)},
    )
    order.payment_intent_id = result["payment_intent_id"]
    order.payment_provider = PaymentProvider.STRIPE
    await db.flush()
    return PaymentIntentResponse(
        order_id=order.id,
        provider=PaymentProvider.STRIPE,
        client_secret=result["client_secret"],
        amount=order.total,
    )


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, db: DB):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    event = await stripe_service.verify_webhook(payload, sig)

    if event["type"] == "payment_intent.succeeded":
        pi = event["data"]["object"]
        metadata = pi.get("metadata", {})
        order_id = metadata.get("order_id")
        course_id = metadata.get("course_id")

        if order_id:
            result = await db.execute(select(Order).where(Order.payment_intent_id == pi["id"]))
            order = result.scalar_one_or_none()
            if order:
                order.payment_status = PaymentStatus.COMPLETED
                order.status = OrderStatus.PAID
                from app.tasks.order_tasks import process_paid_order
                process_paid_order.delay(str(order.id))

        if course_id and metadata.get("type") == "course_purchase":
            from app.models.courses import CoursePayment, CoursePaymentStatus, Course, Enrollment
            cp_result = await db.execute(
                select(CoursePayment).where(CoursePayment.payment_intent_id == pi["id"])
            )
            course_payment = cp_result.scalar_one_or_none()
            if course_payment and course_payment.status != CoursePaymentStatus.PAID:
                course_payment.status = CoursePaymentStatus.PAID
                # Create enrollment if not already exists (idempotent fallback)
                existing_enroll = await db.execute(
                    select(Enrollment).where(
                        Enrollment.user_id == course_payment.user_id,
                        Enrollment.course_id == course_payment.course_id,
                    )
                )
                if not existing_enroll.scalar_one_or_none():
                    db.add(Enrollment(
                        user_id=course_payment.user_id,
                        course_id=course_payment.course_id,
                    ))

    elif event["type"] == "payment_intent.payment_failed":
        pi = event["data"]["object"]
        result = await db.execute(select(Order).where(Order.payment_intent_id == pi["id"]))
        order = result.scalar_one_or_none()
        if order:
            order.payment_status = PaymentStatus.FAILED

        # Also mark course payment as failed
        from app.models.courses import CoursePayment, CoursePaymentStatus
        cp_result = await db.execute(
            select(CoursePayment).where(CoursePayment.payment_intent_id == pi["id"])
        )
        cp = cp_result.scalar_one_or_none()
        if cp:
            cp.status = CoursePaymentStatus.FAILED

    return {"received": True}


# ── PayPal ────────────────────────────────────────────────────────────────────

@router.post("/paypal/intent/{order_id}", response_model=PaymentIntentResponse)
async def paypal_create_intent(order_id: uuid.UUID, db: DB, current_user: CurrentUser):
    order = await _get_pending_order(order_id, current_user.id, db)
    result = await paypal_service.create_order(amount=order.total, order_id=str(order.id))
    order.payment_reference = result["paypal_order_id"]
    order.payment_provider = PaymentProvider.PAYPAL
    await db.flush()
    return PaymentIntentResponse(
        order_id=order.id,
        provider=PaymentProvider.PAYPAL,
        approval_url=result["approval_url"],
        amount=order.total,
    )


@router.post("/paypal/capture/{paypal_order_id}")
async def paypal_capture(paypal_order_id: str, db: DB, current_user: CurrentUser):
    result = await paypal_service.capture_order(paypal_order_id)
    if result.get("status") == "COMPLETED":
        order_result = await db.execute(
            select(Order).where(Order.payment_reference == paypal_order_id, Order.user_id == current_user.id)
        )
        order = order_result.scalar_one_or_none()
        if order:
            order.payment_status = PaymentStatus.COMPLETED
            order.status = OrderStatus.PAID
            from app.tasks.order_tasks import process_paid_order
            process_paid_order.delay(str(order.id))
    return result


# ── MTN MOMO ──────────────────────────────────────────────────────────────────

@router.post("/momo/intent/{order_id}", response_model=PaymentIntentResponse)
async def momo_create_intent(order_id: uuid.UUID, phone_number: str, db: DB, current_user: CurrentUser):
    order = await _get_pending_order(order_id, current_user.id, db)
    reference = await momo_service.request_to_pay(
        amount=order.total,
        phone_number=phone_number,
        order_id=str(order.id),
    )
    order.payment_reference = reference
    order.payment_provider = PaymentProvider.MOMO
    await db.flush()
    return PaymentIntentResponse(
        order_id=order.id,
        provider=PaymentProvider.MOMO,
        payment_reference=reference,
        amount=order.total,
    )


@router.post("/momo/callback")
async def momo_callback(
    request: Request,
    db: DB,
    secret: str = Query(default=""),
):
    """MOMO async callback — verifies secret token, re-checks status via API, then updates order."""
    if not settings.MOMO_CALLBACK_SECRET or not hmac.compare_digest(secret, settings.MOMO_CALLBACK_SECRET):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid callback secret")

    body = await request.json()
    reference = body.get("externalId") or body.get("financialTransactionId")
    if not reference:
        return {"status": "ignored"}

    tx_status = await momo_service.get_transaction_status(reference)
    if tx_status.get("status") == "SUCCESSFUL":
        result = await db.execute(select(Order).where(Order.payment_reference == reference))
        order = result.scalar_one_or_none()
        if order:
            order.payment_status = PaymentStatus.COMPLETED
            order.status = OrderStatus.PAID
    return {"status": "ok"}


@router.get("/momo/status/{reference}")
async def momo_status(reference: str, current_user: CurrentUser):
    return await momo_service.get_transaction_status(reference)
