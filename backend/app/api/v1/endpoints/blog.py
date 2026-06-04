import uuid
import re
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, func
from app.api.deps import AdminUser, DB
from app.db.redis import cache_delete_pattern, cache_get, cache_set
from app.models.blog import BlogPost
from app.schemas.blog import BlogPostCreate, BlogPostDetailResponse, BlogPostListResponse, BlogPostUpdate

router = APIRouter(prefix="/blog", tags=["blog"])


def _slugify(v: str) -> str:
    v = v.lower().strip()
    v = re.sub(r"[^\w\s-]", "", v)
    v = re.sub(r"[\s_-]+", "-", v)
    return v.strip("-")


# ── Public ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[BlogPostListResponse])
async def list_posts(
    db: DB,
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    tag: Optional[str] = None,
):
    """List published blog posts."""
    cache_key = f"blog:list:{skip}:{limit}:{category}:{tag}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    q = select(BlogPost).where(BlogPost.is_published == True)
    if category:
        q = q.where(BlogPost.category == category)
    if tag:
        q = q.where(BlogPost.tags.ilike(f"%{tag}%"))
    q = q.order_by(BlogPost.published_at.desc().nulls_last(), BlogPost.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    posts = result.scalars().all()
    data = [BlogPostListResponse.model_validate(p).model_dump(mode="json") for p in posts]
    await cache_set(cache_key, data, ttl=120)
    return data


@router.get("/categories", response_model=List[str])
async def list_categories(db: DB):
    result = await db.execute(
        select(BlogPost.category).where(BlogPost.is_published == True, BlogPost.category != None).distinct()
    )
    return [r for r in result.scalars() if r]


@router.get("/{slug}", response_model=BlogPostDetailResponse)
async def get_post(slug: str, db: DB):
    """Get a single published post by slug."""
    cached = await cache_get(f"blog:post:{slug}")
    if cached:
        return cached
    result = await db.execute(select(BlogPost).where(BlogPost.slug == slug, BlogPost.is_published == True))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    data = BlogPostDetailResponse.model_validate(post).model_dump(mode="json")
    await cache_set(f"blog:post:{slug}", data, ttl=120)
    return data


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.get("/admin/all", response_model=List[BlogPostListResponse])
async def admin_list_posts(db: DB, _: AdminUser, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(BlogPost).order_by(BlogPost.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.post("/admin/posts", response_model=BlogPostDetailResponse, status_code=201)
async def create_post(payload: BlogPostCreate, db: DB, _: AdminUser):
    slug = payload.slug or _slugify(payload.title)
    existing = await db.execute(select(BlogPost).where(BlogPost.slug == slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A post with this slug already exists.")
    post = BlogPost(
        title=payload.title,
        slug=slug,
        excerpt=payload.excerpt,
        content=payload.content,
        cover_image_url=payload.cover_image_url,
        author_name=payload.author_name,
        category=payload.category,
        tags=payload.tags,
        is_published=payload.is_published,
        published_at=datetime.now(timezone.utc) if payload.is_published else None,
    )
    db.add(post)
    await db.flush()
    await cache_delete_pattern("blog:*")
    return post


@router.patch("/admin/posts/{post_id}", response_model=BlogPostDetailResponse)
async def update_post(post_id: uuid.UUID, payload: BlogPostUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    data = payload.model_dump(exclude_unset=True)
    was_published = post.is_published

    for k, v in data.items():
        setattr(post, k, v)

    if data.get("is_published") and not was_published and not post.published_at:
        post.published_at = datetime.now(timezone.utc)

    post.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await cache_delete_pattern("blog:*")
    return post


@router.delete("/admin/posts/{post_id}", status_code=204)
async def delete_post(post_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await db.delete(post)
    await db.flush()
    await cache_delete_pattern("blog:*")
