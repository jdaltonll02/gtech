from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, field_validator
import re


def _slugify(v: str) -> str:
    v = v.lower().strip()
    v = re.sub(r"[^\w\s-]", "", v)
    v = re.sub(r"[\s_-]+", "-", v)
    return v.strip("-")


class BlogPostCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: str = ""
    cover_image_url: Optional[str] = None
    author_name: str = "G-Tech Team"
    category: Optional[str] = None
    tags: Optional[str] = None
    is_published: bool = False

    @field_validator("slug", mode="before")
    @classmethod
    def auto_slug(cls, v, info):
        if not v:
            title = info.data.get("title", "")
            return _slugify(title)
        return _slugify(v)


class BlogPostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_image_url: Optional[str] = None
    author_name: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[str] = None
    is_published: Optional[bool] = None


class BlogPostListResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    excerpt: Optional[str]
    cover_image_url: Optional[str]
    author_name: str
    category: Optional[str]
    tags: Optional[str]
    is_published: bool
    published_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class BlogPostDetailResponse(BlogPostListResponse):
    content: str
