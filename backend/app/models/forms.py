import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class DynamicForm(Base):
    __tablename__ = "dynamic_forms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    slug: Mapped[str] = mapped_column(String(500), unique=True, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(100), default="general", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requires_auth: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    success_message: Mapped[Optional[str]] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False)

    fields: Mapped[list["FormField"]] = relationship(
        "FormField", back_populates="form", cascade="all, delete-orphan",
        order_by="FormField.order_index",
    )
    submissions: Mapped[list["FormSubmission"]] = relationship(
        "FormSubmission", back_populates="form", cascade="all, delete-orphan",
    )


class FormField(Base):
    __tablename__ = "form_fields"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dynamic_forms.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(500), nullable=False)
    # field_type: short_text | long_text | dropdown | radio | checkbox | file | date | number | email | phone | section_header | url
    field_type: Mapped[str] = mapped_column(String(50), nullable=False)
    options: Mapped[Optional[list]] = mapped_column(JSON)  # for dropdown / radio / checkbox
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    placeholder: Mapped[Optional[str]] = mapped_column(String(500))
    helper_text: Mapped[Optional[str]] = mapped_column(String(500))

    form: Mapped["DynamicForm"] = relationship("DynamicForm", back_populates="fields")


class FormSubmission(Base):
    __tablename__ = "form_submissions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    form_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dynamic_forms.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    responses: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    submitter_name: Mapped[Optional[str]] = mapped_column(String(255))
    submitter_email: Mapped[Optional[str]] = mapped_column(String(255))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, nullable=False)

    form: Mapped["DynamicForm"] = relationship("DynamicForm", back_populates="submissions")
