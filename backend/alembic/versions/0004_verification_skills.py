"""add verification_token and skills table

Revision ID: 0004_verification_skills
Revises: 0003_product_image_urls
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '0004_verification_skills'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('verification_token', sa.String(255), nullable=True))

    op.create_table(
        'skills',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('category', sa.String(100), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
    )


def downgrade() -> None:
    op.drop_table('skills')
    op.drop_column('users', 'verification_token')
