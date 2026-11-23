from decimal import Decimal
import httpx
from fastapi import HTTPException, status
from app.core.config import settings

_PAYPAL_URLS = {
    "sandbox": "https://api-m.sandbox.paypal.com",
    "live": "https://api-m.paypal.com",
}


def _base_url() -> str:
    return _PAYPAL_URLS.get(settings.PAYPAL_MODE, _PAYPAL_URLS["sandbox"])


async def _get_access_token() -> str:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_base_url()}/v1/oauth2/token",
            auth=(settings.PAYPAL_CLIENT_ID, settings.PAYPAL_CLIENT_SECRET),
            data={"grant_type": "client_credentials"},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="PayPal auth failed")
    return resp.json()["access_token"]


async def create_order(amount: Decimal, currency: str = "USD", order_id: str = "") -> dict:
    token = await _get_access_token()
    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "reference_id": str(order_id),
                "amount": {"currency_code": currency.upper(), "value": str(amount)},
            }
        ],
        "application_context": {
            "return_url": f"{settings.FRONTEND_URL}/store/checkout?paypal=success",
            "cancel_url": f"{settings.FRONTEND_URL}/store/checkout?paypal=cancel",
        },
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_base_url()}/v2/checkout/orders",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"PayPal order failed: {resp.text}")
    data = resp.json()
    approval_url = next((l["href"] for l in data.get("links", []) if l["rel"] == "approve"), None)
    return {"paypal_order_id": data["id"], "approval_url": approval_url}


async def capture_order(paypal_order_id: str) -> dict:
    token = await _get_access_token()
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{_base_url()}/v2/checkout/orders/{paypal_order_id}/capture",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"PayPal capture failed: {resp.text}")
    data = resp.json()
    return {"status": data.get("status"), "paypal_order_id": data.get("id")}
