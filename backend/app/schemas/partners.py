from typing import Optional
from uuid import UUID
from pydantic import BaseModel, HttpUrl


# ── Partner ──────────────────────────────────────────────────────────────────

class PartnerBase(BaseModel):
    name: str
    description: Optional[str] = None
    logo_url: str
    website_url: str
    order_index: int = 0


class PartnerCreate(PartnerBase):
    pass


class PartnerUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    order_index: Optional[int] = None


class PartnerResponse(PartnerBase):
    id: UUID
    model_config = {"from_attributes": True}


# ── Business ─────────────────────────────────────────────────────────────────

class BusinessBase(BaseModel):
    name: str
    description: Optional[str] = None
    logo_url: str
    website_url: str
    order_index: int = 0


class BusinessCreate(BusinessBase):
    pass


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    order_index: Optional[int] = None


class BusinessResponse(BusinessBase):
    id: UUID
    model_config = {"from_attributes": True}
