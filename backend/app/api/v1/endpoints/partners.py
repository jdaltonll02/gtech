import uuid
from typing import List
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from app.api.deps import AdminUser, PartnersAdminUser, DB
from app.db.redis import cache_delete_pattern, cache_get, cache_set
from app.models.partners import Partner, Business
from app.schemas.partners import (
    PartnerCreate, PartnerResponse, PartnerUpdate,
    BusinessCreate, BusinessResponse, BusinessUpdate,
)

router = APIRouter(prefix="/partners", tags=["partners"])


# ── Generic helpers ───────────────────────────────────────────────────────────

def _not_found(name: str):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{name} not found")


def _apply_update(obj, data: dict):
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)


# ── Partners ──────────────────────────────────────────────────────────────────

@router.get("", response_model=List[PartnerResponse])
async def list_partners(db: DB):
    cached = await cache_get("partners:all")
    if cached:
        return cached
    result = await db.execute(select(Partner).order_by(Partner.order_index))
    data = [PartnerResponse.model_validate(r).model_dump(mode="json") for r in result.scalars()]
    await cache_set("partners:all", data, ttl=300)
    return data


@router.post("/admin", response_model=PartnerResponse, status_code=201)
async def create_partner(payload: PartnerCreate, db: DB, _: PartnersAdminUser):
    obj = Partner(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await cache_delete_pattern("partners:*")
    return obj


@router.get("/{partner_id}", response_model=PartnerResponse)
async def get_partner(partner_id: uuid.UUID, db: DB):
    result = await db.execute(select(Partner).where(Partner.id == partner_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Partner")
    return obj


@router.patch("/admin/{partner_id}", response_model=PartnerResponse)
async def update_partner(partner_id: uuid.UUID, payload: PartnerUpdate, db: DB, _: PartnersAdminUser):
    result = await db.execute(select(Partner).where(Partner.id == partner_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Partner")
    _apply_update(obj, payload.model_dump())
    await db.flush()
    await cache_delete_pattern("partners:*")
    return obj


@router.delete("/admin/{partner_id}", status_code=204)
async def delete_partner(partner_id: uuid.UUID, db: DB, _: PartnersAdminUser):
    result = await db.execute(select(Partner).where(Partner.id == partner_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Partner")
    await db.delete(obj)
    await db.flush()
    await cache_delete_pattern("partners:*")


# ── Businesses ────────────────────────────────────────────────────────────────

@router.get("/businesses", response_model=List[BusinessResponse])
async def list_businesses(db: DB):
    cached = await cache_get("businesses:all")
    if cached:
        return cached
    result = await db.execute(select(Business).order_by(Business.order_index))
    data = [BusinessResponse.model_validate(r).model_dump(mode="json") for r in result.scalars()]
    await cache_set("businesses:all", data, ttl=300)
    return data


@router.post("/admin/businesses", response_model=BusinessResponse, status_code=201)
async def create_business(payload: BusinessCreate, db: DB, _: PartnersAdminUser):
    obj = Business(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await cache_delete_pattern("businesses:*")
    return obj


@router.get("/businesses/{business_id}", response_model=BusinessResponse)
async def get_business(business_id: uuid.UUID, db: DB):
    result = await db.execute(select(Business).where(Business.id == business_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Business")
    return obj


@router.patch("/admin/businesses/{business_id}", response_model=BusinessResponse)
async def update_business(business_id: uuid.UUID, payload: BusinessUpdate, db: DB, _: PartnersAdminUser):
    result = await db.execute(select(Business).where(Business.id == business_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Business")
    _apply_update(obj, payload.model_dump())
    await db.flush()
    await cache_delete_pattern("businesses:*")
    return obj


@router.delete("/admin/businesses/{business_id}", status_code=204)
async def delete_business(business_id: uuid.UUID, db: DB, _: PartnersAdminUser):
    result = await db.execute(select(Business).where(Business.id == business_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Business")
    await db.delete(obj)
    await db.flush()
    await cache_delete_pattern("businesses:*")
