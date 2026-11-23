import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Permission constants ───────────────────────────────────────────────────────

ALL_PERMISSIONS: list[str] = [
    "manage_courses",       # Create/edit/delete ALL courses
    "manage_own_courses",   # Create/edit/delete only assigned courses
    "manage_ecommerce",     # Products, categories, orders
    "manage_blog",          # Blog posts
    "manage_tickets",       # Support tickets
    "manage_users",         # View/manage user accounts
    "manage_portfolio",     # Portfolio CMS (projects, experience, etc.)
    "manage_media",         # File uploads and gallery
    "manage_forms",         # Dynamic forms
    "manage_partners",      # Partners and businesses
    "view_analytics",       # Dashboard analytics
    "manage_roles",         # Staff roles — superadmin only
]

PERMISSION_LABELS: dict[str, str] = {
    "manage_courses": "Manage All Courses",
    "manage_own_courses": "Manage Assigned Courses Only",
    "manage_ecommerce": "Manage E-commerce",
    "manage_blog": "Manage Blog",
    "manage_tickets": "Manage Support Tickets",
    "manage_users": "Manage Users",
    "manage_portfolio": "Manage Portfolio",
    "manage_media": "Manage Media",
    "manage_forms": "Manage Forms",
    "manage_partners": "Manage Partners",
    "view_analytics": "View Analytics",
    "manage_roles": "Manage Staff Roles",
}

PREDEFINED_ROLES: list[dict] = [
    {
        "slug": "instructor",
        "name": "Instructor",
        "description": "Can create and manage only their assigned courses.",
        "permissions": ["manage_own_courses", "manage_media"],
        "is_system": True,
    },
    {
        "slug": "learning_admin",
        "name": "Learning Administrator",
        "description": "Can manage all courses and learning content.",
        "permissions": ["manage_courses", "manage_media", "view_analytics"],
        "is_system": True,
    },
    {
        "slug": "product_manager",
        "name": "Product Manager",
        "description": "Can manage the e-commerce store, products and orders.",
        "permissions": ["manage_ecommerce", "manage_media", "view_analytics"],
        "is_system": True,
    },
    {
        "slug": "blogger",
        "name": "Blogger",
        "description": "Can create and publish blog posts.",
        "permissions": ["manage_blog", "manage_media"],
        "is_system": True,
    },
    {
        "slug": "system_admin",
        "name": "System Administrator",
        "description": "Full system access. Can only be assigned by a superadmin.",
        "permissions": [
            "manage_courses", "manage_own_courses", "manage_ecommerce",
            "manage_blog", "manage_tickets", "manage_users",
            "manage_portfolio", "manage_media", "manage_forms",
            "manage_partners", "view_analytics",
        ],
        "is_system": True,
    },
    {
        "slug": "support_agent",
        "name": "Customer Support",
        "description": "Can view and respond to support tickets.",
        "permissions": ["manage_tickets", "view_analytics"],
        "is_system": True,
    },
]


class StaffRole(Base):
    __tablename__ = "staff_roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    permissions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    assignments: Mapped[list["UserStaffRole"]] = relationship("UserStaffRole", back_populates="role", cascade="all, delete-orphan")


class UserStaffRole(Base):
    __tablename__ = "user_staff_roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("staff_roles.id", ondelete="CASCADE"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Stores extra context, e.g. {"course_ids": ["uuid1", "uuid2"]} for instructors
    role_metadata: Mapped[Optional[dict]] = mapped_column(JSON)
    assigned_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    role: Mapped["StaffRole"] = relationship("StaffRole", back_populates="assignments")
    user = relationship("User", foreign_keys=[user_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
