"""add google_id to users

Revision ID: 0010_google_oauth
Revises: 0009_partners_businesses
Create Date: 2026-06-02

"""
from alembic import op
import sqlalchemy as sa

revision = '0010_google_oauth'
down_revision = '0009_partners_businesses'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('google_id', sa.String(255), nullable=True))
    op.create_unique_constraint('uq_users_google_id', 'users', ['google_id'])
    op.create_index('ix_users_google_id', 'users', ['google_id'])


def downgrade() -> None:
    op.drop_index('ix_users_google_id', table_name='users')
    op.drop_constraint('uq_users_google_id', 'users', type_='unique')
    op.drop_column('users', 'google_id')
