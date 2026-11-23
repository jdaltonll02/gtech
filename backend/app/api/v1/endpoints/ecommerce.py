import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.api.deps import AdminUser, EcommerceAdminUser, CurrentUser, DB
from app.core.config import settings
from app.models.ecommerce import CartItem, Category, Order, OrderItem, OrderStatus, PaymentStatus, Product
from app.models.ratings import ProductRating
from app.models.user import User
from app.schemas.ecommerce import (
    CartItemAdd, CartItemResponse, CartItemUpdate, CartResponse,
    CategoryCreate, CategoryResponse, CategoryUpdate,
    CheckoutRequest, OrderResponse,
    ProductCreate, ProductResponse, ProductUpdate,
)
from app.schemas.ratings import ProductRatingCreate, ProductRatingResponse, RatingSummary

router = APIRouter(prefix="/ecommerce", tags=["ecommerce"])


def _tax_rate() -> Decimal:
    return Decimal(str(settings.TAX_RATE))


def _effective_price(product: Product) -> Decimal:
    """Use discounted_price when present; otherwise fall back to base price."""
    return product.discounted_price if product.discounted_price is not None else product.price


def _normalize_product_images(product: Product) -> Product:
    image_urls = list(product.image_urls or [])
    if product.image_url and product.image_url not in image_urls:
        image_urls.insert(0, product.image_url)
    if image_urls and not product.image_url:
        product.image_url = image_urls[0]
    product.image_urls = image_urls
    return product


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=List[CategoryResponse])
async def list_categories(db: DB):
    result = await db.execute(select(Category))
    return result.scalars().all()


@router.post("/categories", response_model=CategoryResponse, status_code=201)
async def create_category(payload: CategoryCreate, db: DB, _: EcommerceAdminUser):
    obj = Category(**payload.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/categories/{cat_id}", response_model=CategoryResponse)
async def update_category(cat_id: uuid.UUID, payload: CategoryUpdate, db: DB, _: EcommerceAdminUser):
    result = await db.execute(select(Category).where(Category.id == cat_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/categories/{cat_id}", status_code=204)
async def delete_category(cat_id: uuid.UUID, db: DB, _: EcommerceAdminUser):
    result = await db.execute(select(Category).where(Category.id == cat_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(obj)


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("/products", response_model=List[ProductResponse])
async def list_products(db: DB, skip: int = 0, limit: int = 50, category_id: uuid.UUID | None = None):
    q = select(Product).options(selectinload(Product.category)).where(Product.is_active == True)
    if category_id:
        q = q.where(Product.category_id == category_id)
    result = await db.execute(q.offset(skip).limit(limit))
    products = result.scalars().all()
    return [_normalize_product_images(p) for p in products]


@router.post("/products", response_model=ProductResponse, status_code=201)
async def create_product(payload: ProductCreate, db: DB, _: EcommerceAdminUser):
    data = payload.model_dump()
    image_urls = data.get("image_urls") or []
    if data.get("image_url") and data["image_url"] not in image_urls:
        image_urls = [data["image_url"], *image_urls]
    if image_urls and not data.get("image_url"):
        data["image_url"] = image_urls[0]
    data["image_urls"] = image_urls
    obj = Product(**data)
    db.add(obj)
    await db.flush()
    await db.refresh(obj, ["category"])
    return _normalize_product_images(obj)


@router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: uuid.UUID, db: DB):
    result = await db.execute(
        select(Product).options(selectinload(Product.category)).where(Product.id == product_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")
    return _normalize_product_images(obj)


@router.patch("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: uuid.UUID, payload: ProductUpdate, db: DB, _: EcommerceAdminUser):
    result = await db.execute(select(Product).where(Product.id == product_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")
    updates = payload.model_dump(exclude_unset=True)
    effective_original = updates.get("original_price", obj.original_price)
    effective_discounted = updates.get("discounted_price", obj.discounted_price)
    if effective_original is not None and effective_discounted is not None and effective_discounted > effective_original:
        raise HTTPException(status_code=422, detail="Discounted price cannot be greater than original price")

    if "image_urls" in updates and updates["image_urls"] is not None:
        image_urls = updates["image_urls"]
        if updates.get("image_url") and updates["image_url"] not in image_urls:
            image_urls = [updates["image_url"], *image_urls]
        if image_urls and "image_url" not in updates:
            updates["image_url"] = image_urls[0]
        if not image_urls and "image_url" not in updates:
            updates["image_url"] = None
        updates["image_urls"] = image_urls
    elif "image_url" in updates:
        url = updates.get("image_url")
        if url:
            existing = list(obj.image_urls or [])
            if url not in existing:
                existing.insert(0, url)
            updates["image_urls"] = existing

    for k, v in updates.items():
        setattr(obj, k, v)
    await db.flush()
    await db.refresh(obj, ["category"])
    return _normalize_product_images(obj)


@router.delete("/products/{product_id}", status_code=204)
async def delete_product(product_id: uuid.UUID, db: DB, _: EcommerceAdminUser):
    result = await db.execute(select(Product).where(Product.id == product_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Product not found")
    await db.delete(obj)


# ── Cart ──────────────────────────────────────────────────────────────────────

async def _get_cart_items(user_id: uuid.UUID, db) -> List[CartItem]:
    result = await db.execute(
        select(CartItem)
        .options(selectinload(CartItem.product).selectinload(Product.category))
        .where(CartItem.user_id == user_id)
    )
    return result.scalars().all()


def _compute_cart(items: List[CartItem]) -> CartResponse:
    subtotal = sum(_effective_price(i.product) * i.quantity for i in items)
    tax = (subtotal * _tax_rate()).quantize(Decimal("0.01"))
    return CartResponse(
        items=[CartItemResponse.model_validate(i) for i in items],
        subtotal=subtotal,
        tax=tax,
        total=subtotal + tax,
    )


@router.get("/cart", response_model=CartResponse)
async def get_cart(db: DB, current_user: CurrentUser):
    items = await _get_cart_items(current_user.id, db)
    return _compute_cart(items)


@router.post("/cart", response_model=CartResponse, status_code=201)
async def add_to_cart(payload: CartItemAdd, db: DB, current_user: CurrentUser):
    prod_result = await db.execute(select(Product).where(Product.id == payload.product_id, Product.is_active == True))
    product = prod_result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = await db.execute(
        select(CartItem).where(CartItem.user_id == current_user.id, CartItem.product_id == payload.product_id)
    )
    item = existing.scalar_one_or_none()
    if item:
        item.quantity += payload.quantity
    else:
        item = CartItem(user_id=current_user.id, product_id=payload.product_id, quantity=payload.quantity)
        db.add(item)
    await db.flush()
    items = await _get_cart_items(current_user.id, db)
    return _compute_cart(items)


@router.patch("/cart/{item_id}", response_model=CartResponse)
async def update_cart_item(item_id: uuid.UUID, payload: CartItemUpdate, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.user_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    item.quantity = payload.quantity
    await db.flush()
    items = await _get_cart_items(current_user.id, db)
    return _compute_cart(items)


@router.delete("/cart/{item_id}", response_model=CartResponse)
async def remove_cart_item(item_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.user_id == current_user.id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    await db.delete(item)
    await db.flush()
    items = await _get_cart_items(current_user.id, db)
    return _compute_cart(items)


@router.delete("/cart", status_code=204)
async def clear_cart(db: DB, current_user: CurrentUser):
    items = await _get_cart_items(current_user.id, db)
    for item in items:
        await db.delete(item)


# ── Orders ────────────────────────────────────────────────────────────────────

@router.get("/orders", response_model=List[OrderResponse])
async def list_orders(db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.user_id == current_user.id)
        .order_by(Order.created_at.desc())
    )
    return result.scalars().all()


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .where(Order.id == order_id, Order.user_id == current_user.id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.post("/orders/checkout", response_model=OrderResponse, status_code=201)
async def create_order_from_cart(payload: CheckoutRequest, db: DB, current_user: CurrentUser):
    """Creates an order from the current cart (payment intent created separately)."""
    items = await _get_cart_items(current_user.id, db)
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cart is empty")

    subtotal = sum(_effective_price(i.product) * i.quantity for i in items)
    tax = (subtotal * _tax_rate()).quantize(Decimal("0.01"))
    total = subtotal + tax

    order = Order(
        user_id=current_user.id,
        status=OrderStatus.PAYMENT_PENDING,
        subtotal=subtotal,
        tax=tax,
        total=total,
        payment_provider=payload.payment_provider,
        payment_status=PaymentStatus.PENDING,
        billing_email=payload.billing_email,
        billing_name=payload.billing_name,
    )
    db.add(order)
    await db.flush()

    for item in items:
        db.add(OrderItem(
            order_id=order.id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=_effective_price(item.product),
            total_price=_effective_price(item.product) * item.quantity,
            product_name=item.product.name,
        ))

    # Clear cart
    for item in items:
        await db.delete(item)

    await db.flush()
    await db.refresh(order, ["items"])
    return order


# ── Product Ratings ───────────────────────────────────────────────────────────

@router.get("/products/{product_id}/ratings/summary", response_model=RatingSummary)
async def get_product_rating_summary(product_id: uuid.UUID, db: DB):
    result = await db.execute(
        select(ProductRating).where(ProductRating.product_id == product_id)
    )
    ratings = result.scalars().all()
    if not ratings:
        return RatingSummary(avg_rating=0.0, rating_count=0, distribution={})
    avg = sum(r.rating for r in ratings) / len(ratings)
    dist = {i: 0 for i in range(1, 6)}
    for r in ratings:
        dist[r.rating] = dist.get(r.rating, 0) + 1
    return RatingSummary(avg_rating=round(avg, 1), rating_count=len(ratings), distribution=dist)


@router.get("/products/{product_id}/ratings", response_model=List[ProductRatingResponse])
async def list_product_ratings(product_id: uuid.UUID, db: DB, skip: int = 0, limit: int = 20):
    result = await db.execute(
        select(ProductRating)
        .where(ProductRating.product_id == product_id)
        .order_by(ProductRating.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = result.scalars().all()
    out = []
    for r in rows:
        user_result = await db.execute(select(User).where(User.id == r.user_id))
        user = user_result.scalar_one_or_none()
        out.append(ProductRatingResponse(
            id=r.id, user_id=r.user_id, product_id=r.product_id,
            rating=r.rating, review=r.review,
            author_name=user.full_name if user else "Anonymous",
            created_at=r.created_at, updated_at=r.updated_at,
        ))
    return out


@router.get("/products/{product_id}/ratings/me", response_model=Optional[ProductRatingResponse])
async def get_my_product_rating(product_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(ProductRating).where(
            ProductRating.product_id == product_id,
            ProductRating.user_id == current_user.id,
        )
    )
    r = result.scalar_one_or_none()
    if not r:
        return None
    return ProductRatingResponse(
        id=r.id, user_id=r.user_id, product_id=r.product_id,
        rating=r.rating, review=r.review,
        author_name=current_user.full_name,
        created_at=r.created_at, updated_at=r.updated_at,
    )


@router.post("/products/{product_id}/rate", response_model=ProductRatingResponse)
async def rate_product(product_id: uuid.UUID, payload: ProductRatingCreate, db: DB, current_user: CurrentUser):
    """Submit or update a product rating (any authenticated user)."""
    product_result = await db.execute(select(Product).where(Product.id == product_id))
    if not product_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Product not found")

    existing = await db.execute(
        select(ProductRating).where(
            ProductRating.product_id == product_id,
            ProductRating.user_id == current_user.id,
        )
    )
    rating = existing.scalar_one_or_none()
    if rating:
        rating.rating = payload.rating
        rating.review = payload.review
        rating.updated_at = datetime.now(timezone.utc)
    else:
        rating = ProductRating(
            user_id=current_user.id,
            product_id=product_id,
            rating=payload.rating,
            review=payload.review,
        )
        db.add(rating)
    await db.flush()
    return ProductRatingResponse(
        id=rating.id, user_id=rating.user_id, product_id=rating.product_id,
        rating=rating.rating, review=rating.review,
        author_name=current_user.full_name,
        created_at=rating.created_at, updated_at=rating.updated_at,
    )


@router.delete("/products/{product_id}/rate", status_code=204)
async def delete_product_rating(product_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(ProductRating).where(
            ProductRating.product_id == product_id,
            ProductRating.user_id == current_user.id,
        )
    )
    rating = result.scalar_one_or_none()
    if rating:
        await db.delete(rating)
        await db.flush()
