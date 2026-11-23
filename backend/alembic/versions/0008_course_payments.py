"""add course_payments table

Revision ID: 0008_course_payments
Revises: 0007_profile_settings
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0008_course_payments'
down_revision = '0007_profile_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'course_payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('payment_intent_id', sa.String(255), nullable=False, unique=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
    )
    op.create_index('ix_course_payments_payment_intent_id', 'course_payments', ['payment_intent_id'])
    op.create_index('ix_course_payments_user_course', 'course_payments', ['user_id', 'course_id'])


def downgrade() -> None:
    op.drop_index('ix_course_payments_user_course', table_name='course_payments')
    op.drop_index('ix_course_payments_payment_intent_id', table_name='course_payments')
    op.drop_table('course_payments')
