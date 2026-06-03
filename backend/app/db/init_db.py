"""Run once to seed the first superadmin: python -m app.db.init_db"""
import asyncio
from sqlalchemy import select
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole


async def seed():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == settings.FIRST_SUPERADMIN_EMAIL))
        if result.scalar_one_or_none():
            print("Superadmin already exists.")
            return
        user = User(
            email=settings.FIRST_SUPERADMIN_EMAIL,
            full_name="Super Admin",
            hashed_password=hash_password(settings.FIRST_SUPERADMIN_PASSWORD),
            role=UserRole.SUPERADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        print(f"Superadmin created: {settings.FIRST_SUPERADMIN_EMAIL}")


if __name__ == "__main__":
    asyncio.run(seed())
