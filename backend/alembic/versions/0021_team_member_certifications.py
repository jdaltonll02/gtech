"""team_member_certifications

Revision ID: 0021_team_member_certifications
Revises: 0020_team_members
Create Date: 2026-06-07
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0021_team_member_certifications"
down_revision = "0020_team_members"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "team_member_certifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("team_member_id", UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("issuer", sa.String(255), nullable=False),
        sa.Column("date", sa.String(20), nullable=False),
        sa.Column("credential_url", sa.String(500)),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_table("team_member_certifications")
