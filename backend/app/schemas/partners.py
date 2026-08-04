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
    tagline: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    founded_year: Optional[str] = None
    location: Optional[str] = None
    pitch_summary: Optional[str] = None
    problem_statement: Optional[str] = None
    solution: Optional[str] = None
    gallery_urls: list[str] = []
    contact_email: Optional[str] = None
    is_seeking_investment: bool = False
    investment_ask: Optional[str] = None


class BusinessCreate(BusinessBase):
    pass


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website_url: Optional[str] = None
    order_index: Optional[int] = None
    tagline: Optional[str] = None
    industry: Optional[str] = None
    stage: Optional[str] = None
    founded_year: Optional[str] = None
    location: Optional[str] = None
    pitch_summary: Optional[str] = None
    problem_statement: Optional[str] = None
    solution: Optional[str] = None
    gallery_urls: Optional[list[str]] = None
    contact_email: Optional[str] = None
    is_seeking_investment: Optional[bool] = None
    investment_ask: Optional[str] = None


class BusinessResponse(BusinessBase):
    id: UUID
    model_config = {"from_attributes": True}
