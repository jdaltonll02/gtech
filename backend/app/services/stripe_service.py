from decimal import Decimal
import stripe
from fastapi import HTTPException, Request, status
from app.core.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY


async def create_payment_intent(amount: Decimal, currency: str = "usd", metadata: dict = {}) -> dict:
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),  # cents
            currency=currency.lower(),
            metadata=metadata,
            automatic_payment_methods={"enabled": True},
        )
        return {"client_secret": intent.client_secret, "payment_intent_id": intent.id}
    except stripe.StripeError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


async def verify_webhook(payload: bytes, sig_header: str) -> stripe.Event:
    try:
        return stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.SignatureVerificationError) as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Webhook error: {e}")


async def create_refund(payment_intent_id: str, amount: Decimal | None = None) -> dict:
    try:
        kwargs = {"payment_intent": payment_intent_id}
        if amount:
            kwargs["amount"] = int(amount * 100)
        refund = stripe.Refund.create(**kwargs)
        return {"refund_id": refund.id, "status": refund.status}
    except stripe.StripeError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
