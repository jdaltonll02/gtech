"""merge 0011_fix_enum_types and 0011_product_extended_fields

Revision ID: 0012_merge_heads
Revises: 0011_fix_enum_types, 0011_product_extended_fields
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op

revision = '0012_merge_heads'
down_revision = ('0011_fix_enum_types', '0011_product_extended_fields')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
