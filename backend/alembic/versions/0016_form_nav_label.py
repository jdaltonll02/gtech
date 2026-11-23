"""add nav_label to dynamic_forms

Revision ID: 0016_form_nav_label
Revises: 0015_blog_and_forms
Create Date: 2026-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "0016_form_nav_label"
down_revision = "0015_blog_and_forms"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("dynamic_forms", sa.Column("nav_label", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("dynamic_forms", "nav_label")
