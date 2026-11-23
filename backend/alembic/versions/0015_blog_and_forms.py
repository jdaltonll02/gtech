"""add blog_posts, dynamic_forms, form_fields, form_submissions

Revision ID: 0015_blog_and_forms
Revises: 0014_ratings_testimonials
Create Date: 2026-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0015_blog_and_forms"
down_revision = "0014_ratings_testimonials"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # blog_posts
    op.create_table(
        "blog_posts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("slug", sa.String(500), nullable=False, unique=True),
        sa.Column("excerpt", sa.String(1000), nullable=True),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("cover_image_url", sa.String(1000), nullable=True),
        sa.Column("author_name", sa.String(255), nullable=False, server_default="G-Tech Team"),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("tags", sa.String(500), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_blog_posts_slug", "blog_posts", ["slug"], unique=True)
    op.create_index("ix_blog_posts_is_published", "blog_posts", ["is_published"])

    # dynamic_forms
    op.create_table(
        "dynamic_forms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("slug", sa.String(500), nullable=False, unique=True),
        sa.Column("category", sa.String(100), nullable=False, server_default="general"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("requires_auth", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("success_message", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_dynamic_forms_slug", "dynamic_forms", ["slug"], unique=True)

    # form_fields
    op.create_table(
        "form_fields",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("form_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dynamic_forms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(500), nullable=False),
        sa.Column("field_type", sa.String(50), nullable=False),
        sa.Column("options", postgresql.JSON(), nullable=True),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("placeholder", sa.String(500), nullable=True),
        sa.Column("helper_text", sa.String(500), nullable=True),
    )
    op.create_index("ix_form_fields_form_id", "form_fields", ["form_id"])

    # form_submissions
    op.create_table(
        "form_submissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("form_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dynamic_forms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("responses", postgresql.JSON(), nullable=False),
        sa.Column("submitter_name", sa.String(255), nullable=True),
        sa.Column("submitter_email", sa.String(255), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_form_submissions_form_id", "form_submissions", ["form_id"])


def downgrade() -> None:
    op.drop_index("ix_form_submissions_form_id", table_name="form_submissions")
    op.drop_table("form_submissions")
    op.drop_index("ix_form_fields_form_id", table_name="form_fields")
    op.drop_table("form_fields")
    op.drop_index("ix_dynamic_forms_slug", table_name="dynamic_forms")
    op.drop_table("dynamic_forms")
    op.drop_index("ix_blog_posts_is_published", table_name="blog_posts")
    op.drop_index("ix_blog_posts_slug", table_name="blog_posts")
    op.drop_table("blog_posts")
