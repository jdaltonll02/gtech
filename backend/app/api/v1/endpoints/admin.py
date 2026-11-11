import uuid
from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from app.api.deps import AdminUser, DB
from app.models.ecommerce import Order, OrderItem, OrderStatus, PaymentStatus, Product
from app.models.user import User
from app.schemas.admin import AdminStatsResponse, AnalyticsResponse, ProductSalesPoint, RevenuePoint
from app.schemas.ecommerce import OrderResponse
from app.schemas.user import UserResponse, UserUpdateRequest
from pydantic import BaseModel, EmailStr
from app.core.security import hash_password


class UserCreateRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    role: str = "user"
    is_active: bool = True
    is_verified: bool = True

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/analytics", response_model=AnalyticsResponse)
async def get_analytics(db: DB, _: AdminUser):
    total_revenue = await db.scalar(
        select(func.coalesce(func.sum(Order.total), 0)).where(Order.payment_status == PaymentStatus.COMPLETED)
    )
    total_orders = await db.scalar(select(func.count(Order.id)))
    total_users = await db.scalar(select(func.count(User.id)))
    total_products = await db.scalar(select(func.count(Product.id)).where(Product.is_active == True))
    pending_orders = await db.scalar(
        select(func.count(Order.id)).where(Order.status == OrderStatus.PAYMENT_PENDING)
    )

    revenue_rows = await db.execute(
        select(
            func.to_char(Order.created_at, "YYYY-MM").label("month"),
            func.sum(Order.total).label("revenue"),
        )
        .where(Order.payment_status == PaymentStatus.COMPLETED)
        .group_by("month")
        .order_by("month")
        .limit(12)
    )
    revenue_by_month = [RevenuePoint(month=r.month, revenue=float(r.revenue)) for r in revenue_rows]

    sales_rows = await db.execute(
        select(
            OrderItem.product_name,
            func.sum(OrderItem.quantity).label("qty"),
        )
        .group_by(OrderItem.product_name)
        .order_by(func.sum(OrderItem.quantity).desc())
        .limit(10)
    )
    product_sales = [ProductSalesPoint(name=r.product_name, value=float(r.qty)) for r in sales_rows]

    return AnalyticsResponse(
        stats=AdminStatsResponse(
            total_revenue=float(total_revenue),
            total_orders=total_orders,
            total_users=total_users,
            total_products=total_products,
            pending_orders=pending_orders,
        ),
        revenue_by_month=revenue_by_month,
        product_sales=product_sales,
    )


@router.get("/orders", response_model=list[OrderResponse])
async def list_all_orders(db: DB, _: AdminUser, skip: int = 0, limit: int = 50):
    result = await db.execute(
        select(Order)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.patch("/orders/{order_id}/status")
async def update_order_status(order_id: str, new_status: OrderStatus, db: DB, _: AdminUser):
    result = await db.execute(select(Order).where(Order.id == uuid.UUID(order_id)))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = new_status
    await db.flush()
    return {"id": str(order.id), "status": order.status}


@router.get("/users", response_model=list[UserResponse])
async def list_users(db: DB, _: AdminUser, skip: int = 0, limit: int = 200, search: str = ""):
    q = select(User).order_by(User.created_at.desc())
    if search:
        q = q.where(User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%"))
    result = await db.execute(q.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(payload: UserCreateRequest, db: DB, _: AdminUser):
    existing = await db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
        is_verified=payload.is_verified,
    )
    db.add(user)
    await db.flush()
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: uuid.UUID, payload: UserUpdateRequest, db: DB, _: AdminUser):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    await db.flush()
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)


@router.get("/system-status")
async def system_status(_: AdminUser):
    """Returns basic system configuration health flags visible to admins."""
    from app.core.config import settings
    smtp_ok = bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD)
    return {
        "smtp_configured": smtp_ok,
        "smtp_warning": None if smtp_ok else (
            "SMTP is not configured. Email verification and order confirmation emails will not be sent. "
            "Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD in your .env file."
        ),
    }
