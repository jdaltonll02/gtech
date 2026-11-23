from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator, model_validator
from app.models.ecommerce import OrderStatus, PaymentProvider, PaymentStatus


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    model_config = {"from_attributes": True}


# ── Product ───────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    description: str
    price: Decimal
    original_price: Optional[Decimal] = None
    discounted_price: Optional[Decimal] = None
    category_id: Optional[UUID] = None
    image_url: Optional[str] = None
    image_urls: list[str] = Field(default_factory=list)
    in_stock: bool = True
    stock_quantity: int = 0
    is_active: bool = True
    sku: Optional[str] = None
    brand: Optional[str] = None
    tags: Optional[str] = None
    bullet_points: Optional[list[str]] = None
    specifications: Optional[list[dict]] = None
    weight: Optional[str] = None
    dimensions: Optional[str] = None
    condition: str = "new"

    @field_validator("price")
    @classmethod
    def price_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Price cannot be negative")
        return v

    @field_validator("original_price", "discounted_price")
    @classmethod
    def non_negative_display_prices(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("Prices cannot be negative")
        return v

    @model_validator(mode="after")
    def validate_price_relationships(self):
        if self.original_price is not None and self.discounted_price is not None:
            if self.discounted_price > self.original_price:
                raise ValueError("Discounted price cannot be greater than original price")
        return self


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    original_price: Optional[Decimal] = None
    discounted_price: Optional[Decimal] = None
    category_id: Optional[UUID] = None
    image_url: Optional[str] = None
    image_urls: Optional[list[str]] = None
    in_stock: Optional[bool] = None
    stock_quantity: Optional[int] = None
    is_active: Optional[bool] = None
    sku: Optional[str] = None
    brand: Optional[str] = None
    tags: Optional[str] = None
    bullet_points: Optional[list[str]] = None
    specifications: Optional[list[dict]] = None
    weight: Optional[str] = None
    dimensions: Optional[str] = None
    condition: Optional[str] = None

    @field_validator("price", "original_price", "discounted_price")
    @classmethod
    def non_negative_prices(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("Prices cannot be negative")
        return v

    @model_validator(mode="after")
    def validate_price_relationships(self):
        if self.original_price is not None and self.discounted_price is not None:
            if self.discounted_price > self.original_price:
                raise ValueError("Discounted price cannot be greater than original price")
        return self


class ProductResponse(BaseModel):
    id: UUID
    name: str
    description: str
    price: Decimal
    original_price: Optional[Decimal]
    discounted_price: Optional[Decimal]
    category_id: Optional[UUID]
    category: Optional[CategoryResponse]
    image_url: Optional[str]
    image_urls: Optional[list[str]] = None
    in_stock: bool
    stock_quantity: int
    is_active: bool
    sku: Optional[str] = None
    brand: Optional[str] = None
    tags: Optional[str] = None
    bullet_points: Optional[list[str]] = None
    specifications: Optional[list[dict]] = None
    weight: Optional[str] = None
    dimensions: Optional[str] = None
    condition: str = "new"
    avg_rating: float = 0.0
    rating_count: int = 0
    model_config = {"from_attributes": True}


# ── Cart ──────────────────────────────────────────────────────────────────────

class CartItemAdd(BaseModel):
    product_id: UUID
    quantity: int = 1

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        return v


class CartItemUpdate(BaseModel):
    quantity: int

    @field_validator("quantity")
    @classmethod
    def qty_positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("Quantity must be at least 1")
        return v


class CartItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product: ProductResponse
    quantity: int
    model_config = {"from_attributes": True}


class CartResponse(BaseModel):
    items: list[CartItemResponse]
    subtotal: Decimal
    tax: Decimal
    total: Decimal


# ── Order ─────────────────────────────────────────────────────────────────────

class OrderItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    product_name: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: UUID
    status: OrderStatus
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    payment_provider: Optional[PaymentProvider]
    payment_status: PaymentStatus
    billing_email: Optional[str]
    billing_name: Optional[str]
    items: list[OrderItemResponse]
    model_config = {"from_attributes": True}


class CheckoutRequest(BaseModel):
    payment_provider: PaymentProvider
    billing_email: str
    billing_name: str
    phone_number: Optional[str] = None  # required for MOMO


# ── Payment ───────────────────────────────────────────────────────────────────

class PaymentIntentResponse(BaseModel):
    order_id: UUID
    provider: PaymentProvider
    client_secret: Optional[str] = None      # Stripe
    approval_url: Optional[str] = None       # PayPal
    payment_reference: Optional[str] = None  # MOMO
    amount: Decimal
    currency: str = "USD"
