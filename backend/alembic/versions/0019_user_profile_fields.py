"""add extended profile fields to users

Revision ID: 0019_user_profile_fields
Revises: 0018_ai_documents
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa

revision = "0019_user_profile_fields"
down_revision = "0018_ai_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("bio", sa.String(600), nullable=True))
    op.add_column("users", sa.Column("headline", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("job_title", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("company", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("school", sa.String(120), nullable=True))
    op.add_column("users", sa.Column("phone", sa.String(30), nullable=True))
    op.add_column("users", sa.Column("website", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("city", sa.String(80), nullable=True))
    op.add_column("users", sa.Column("country", sa.String(80), nullable=True))
    op.add_column("users", sa.Column("address", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("linkedin_url", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("twitter_url", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("github_url", sa.String(255), nullable=True))


def downgrade() -> None:
    for col in ("bio", "headline", "job_title", "company", "school", "phone",
                "website", "city", "country", "address",
                "linkedin_url", "twitter_url", "github_url"):
        op.drop_column("users", col)
