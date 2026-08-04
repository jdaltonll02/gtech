import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ARRAY
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base


class Partner(Base):
    __tablename__ = "partners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    logo_url: Mapped[str] = mapped_column(String(500), nullable=False)
    website_url: Mapped[str] = mapped_column(String(500), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    logo_url: Mapped[str] = mapped_column(String(500), nullable=False)
    website_url: Mapped[str] = mapped_column(String(500), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # Pitch-deck fields — shown on the internal business detail page reached
    # from the header dropdown (website_url stays as an external link on that page).
    tagline: Mapped[Optional[str]] = mapped_column(String(300))
    industry: Mapped[Optional[str]] = mapped_column(String(150))
    stage: Mapped[Optional[str]] = mapped_column(String(50))
    founded_year: Mapped[Optional[str]] = mapped_column(String(10))
    location: Mapped[Optional[str]] = mapped_column(String(255))
    pitch_summary: Mapped[Optional[str]] = mapped_column(Text)
    problem_statement: Mapped[Optional[str]] = mapped_column(Text)
    solution: Mapped[Optional[str]] = mapped_column(Text)
    gallery_urls: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    contact_email: Mapped[Optional[str]] = mapped_column(String(255))
    is_seeking_investment: Mapped[bool] = mapped_column(Boolean, default=False)
    investment_ask: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
