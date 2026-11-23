"""add extended product fields

Revision ID: 0011_product_extended_fields
Revises: 0010_google_oauth
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0011_product_extended_fields'
down_revision = '0010_google_oauth'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('sku', sa.String(100), nullable=True))
    op.add_column('products', sa.Column('brand', sa.String(255), nullable=True))
    op.add_column('products', sa.Column('tags', sa.String(500), nullable=True))
    op.add_column('products', sa.Column('bullet_points', postgresql.JSON(), nullable=True))
    op.add_column('products', sa.Column('specifications', postgresql.JSON(), nullable=True))
    op.add_column('products', sa.Column('weight', sa.String(50), nullable=True))
    op.add_column('products', sa.Column('dimensions', sa.String(100), nullable=True))
    op.add_column('products', sa.Column('condition', sa.String(20), nullable=False, server_default='new'))
    op.create_index('ix_products_sku', 'products', ['sku'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_products_sku', table_name='products')
    op.drop_column('products', 'condition')
    op.drop_column('products', 'dimensions')
    op.drop_column('products', 'weight')
    op.drop_column('products', 'specifications')
    op.drop_column('products', 'bullet_points')
    op.drop_column('products', 'tags')
    op.drop_column('products', 'brand')
    op.drop_column('products', 'sku')
