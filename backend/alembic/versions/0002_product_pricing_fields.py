"""add product original and discounted prices

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("original_price", sa.Numeric(10, 2), nullable=True))
    op.add_column("products", sa.Column("discounted_price", sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "discounted_price")
    op.drop_column("products", "original_price")
