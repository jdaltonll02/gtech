from fastapi import APIRouter
from app.api.v1.endpoints import auth, portfolio, media, ecommerce, payments, admin, courses, partners, support, blog, forms, rbac, ai

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(portfolio.router)
api_router.include_router(media.router)
api_router.include_router(ecommerce.router)
api_router.include_router(payments.router)
api_router.include_router(admin.router)
api_router.include_router(courses.router)
api_router.include_router(partners.router)
api_router.include_router(support.router)
api_router.include_router(blog.router)
api_router.include_router(forms.router)
api_router.include_router(rbac.router)
api_router.include_router(ai.router)
