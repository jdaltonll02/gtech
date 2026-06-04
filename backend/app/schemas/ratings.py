from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, field_validator


# ── Testimonial ───────────────────────────────────────────────────────────────

class TestimonialCreate(BaseModel):
    author_name: str
    author_title: Optional[str] = None
    content: str
    rating: int

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class TestimonialResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    author_name: str
    author_title: Optional[str]
    content: str
    rating: int
    is_approved: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class TestimonialApprove(BaseModel):
    is_approved: bool


# ── Course Rating ─────────────────────────────────────────────────────────────

class CourseRatingCreate(BaseModel):
    rating: int
    review: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class CourseRatingResponse(BaseModel):
    id: UUID
    user_id: UUID
    course_id: UUID
    rating: int
    review: Optional[str]
    author_name: str = ""
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class RatingSummary(BaseModel):
    avg_rating: float
    rating_count: int
    distribution: dict[int, int] = {}  # {5: 12, 4: 8, ...}


# ── Product Rating ────────────────────────────────────────────────────────────

class ProductRatingCreate(BaseModel):
    rating: int
    review: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def rating_range(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Rating must be between 1 and 5")
        return v


class ProductRatingResponse(BaseModel):
    id: UUID
    user_id: UUID
    product_id: UUID
    rating: int
    review: Optional[str]
    author_name: str = ""
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
