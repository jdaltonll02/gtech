"""add product image urls column

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-03 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("products", sa.Column("image_urls", sa.JSON(), nullable=True))
    op.execute("UPDATE products SET image_urls = '[]' WHERE image_urls IS NULL")
    op.alter_column("products", "image_urls", nullable=False)


def downgrade() -> None:
    op.drop_column("products", "image_urls")
