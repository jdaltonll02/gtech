import uuid
from decimal import Decimal
import httpx
from fastapi import HTTPException, status
from app.core.config import settings


def _headers(token: str | None = None) -> dict:
    h = {
        "Ocp-Apim-Subscription-Key": settings.MOMO_SUBSCRIPTION_KEY,
        "X-Target-Environment": settings.MOMO_ENVIRONMENT,
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


async def _get_access_token() -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.MOMO_BASE_URL}/collection/token/",
            auth=(settings.MOMO_API_USER, settings.MOMO_API_KEY),
            headers=_headers(),
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="MOMO auth failed")
    return resp.json()["access_token"]


async def request_to_pay(
    amount: Decimal,
    phone_number: str,
    order_id: str,
    currency: str = "EUR",
) -> str:
    """Initiate a MOMO collection request. Returns the external transaction reference UUID."""
    token = await _get_access_token()
    reference = str(uuid.uuid4())
    callback_url = settings.MOMO_CALLBACK_URL
    if settings.MOMO_CALLBACK_SECRET:
        sep = "&" if "?" in callback_url else "?"
        callback_url = f"{callback_url}{sep}secret={settings.MOMO_CALLBACK_SECRET}"

    payload = {
        "amount": str(amount),
        "currency": currency,
        "externalId": str(order_id),
        "payer": {"partyIdType": "MSISDN", "partyId": phone_number},
        "payerMessage": "Payment for order",
        "payeeNote": f"Order {order_id}",
        "callbackUrl": callback_url,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.MOMO_BASE_URL}/collection/v1_0/requesttopay",
            json=payload,
            headers={**_headers(token), "X-Reference-Id": reference, "Content-Type": "application/json"},
        )
    if resp.status_code != 202:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"MOMO request failed: {resp.text}")
    return reference


async def get_transaction_status(reference: str) -> dict:
    token = await _get_access_token()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.MOMO_BASE_URL}/collection/v1_0/requesttopay/{reference}",
            headers=_headers(token),
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MOMO status check failed")
    return resp.json()
