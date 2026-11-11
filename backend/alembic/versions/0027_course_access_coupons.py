"""course private access + coupon system

Revision ID: 0027_course_access_coupons
Revises: 0026_badge_composite_unique
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = '0027_course_access_coupons'
down_revision = '0026_badge_composite_unique'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('courses', sa.Column('is_private', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('courses', sa.Column('access_code_hash', sa.String(255), nullable=True))

    op.create_table(
        'coupons',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('discount_type', sa.String(20), nullable=False),
        sa.Column('discount_value', sa.Numeric(10, 2), nullable=False),
        sa.Column('course_id', PG_UUID(as_uuid=True), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=True),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('max_uses_per_user', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_coupons_code', 'coupons', ['code'])

    op.create_table(
        'coupon_redemptions',
        sa.Column('id', PG_UUID(as_uuid=True), primary_key=True),
        sa.Column('coupon_id', PG_UUID(as_uuid=True), sa.ForeignKey('coupons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', PG_UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('course_id', PG_UUID(as_uuid=True), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('discount_applied', sa.Numeric(10, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_coupon_redemptions_coupon_id', 'coupon_redemptions', ['coupon_id'])


def downgrade():
    op.drop_index('ix_coupon_redemptions_coupon_id', table_name='coupon_redemptions')
    op.drop_table('coupon_redemptions')
    op.drop_index('ix_coupons_code', table_name='coupons')
    op.drop_table('coupons')
    op.drop_column('courses', 'access_code_hash')
    op.drop_column('courses', 'is_private')
