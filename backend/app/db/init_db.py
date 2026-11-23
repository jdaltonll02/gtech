"""Run once to seed the first superadmin and predefined staff roles."""
import asyncio
from sqlalchemy import select
from app.core.config import settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.rbac import StaffRole, PREDEFINED_ROLES


async def seed():
    async with AsyncSessionLocal() as db:
        # ── Superadmin ────────────────────────────────────────────────────────
        result = await db.execute(select(User).where(User.email == settings.FIRST_SUPERADMIN_EMAIL))
        if not result.scalar_one_or_none():
            user = User(
                email=settings.FIRST_SUPERADMIN_EMAIL,
                full_name="Super Admin",
                hashed_password=hash_password(settings.FIRST_SUPERADMIN_PASSWORD),
                role=UserRole.SUPERADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add(user)
            await db.flush()
            print(f"Superadmin created: {settings.FIRST_SUPERADMIN_EMAIL}")
        else:
            print("Superadmin already exists.")

        # ── Predefined staff roles ────────────────────────────────────────────
        for role_data in PREDEFINED_ROLES:
            existing = await db.execute(select(StaffRole).where(StaffRole.slug == role_data["slug"]))
            if not existing.scalar_one_or_none():
                role = StaffRole(
                    name=role_data["name"],
                    slug=role_data["slug"],
                    description=role_data["description"],
                    permissions=role_data["permissions"],
                    is_system=role_data["is_system"],
                )
                db.add(role)
                print(f"Seeded role: {role_data['name']}")

        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
