from pydantic import BaseModel


class RevenuePoint(BaseModel):
    month: str
    revenue: float


class ProductSalesPoint(BaseModel):
    name: str
    value: float


class AdminStatsResponse(BaseModel):
    total_revenue: float
    total_orders: int
    total_users: int
    total_products: int
    pending_orders: int


class AnalyticsResponse(BaseModel):
    stats: AdminStatsResponse
    revenue_by_month: list[RevenuePoint]
    product_sales: list[ProductSalesPoint]
