"""add staff_roles and user_staff_roles tables

Revision ID: 0017_rbac
Revises: 0016_form_nav_label
Create Date: 2026-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0017_rbac"
down_revision = "0016_form_nav_label"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "staff_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("permissions", postgresql.JSON(), nullable=False, server_default="[]"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_staff_roles_slug", "staff_roles", ["slug"], unique=True)

    op.create_table(
        "user_staff_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("staff_roles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("role_metadata", postgresql.JSON(), nullable=True),
        sa.Column("assigned_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_user_staff_roles_user_id", "user_staff_roles", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_staff_roles_user_id", table_name="user_staff_roles")
    op.drop_table("user_staff_roles")
    op.drop_index("ix_staff_roles_slug", table_name="staff_roles")
    op.drop_table("staff_roles")
