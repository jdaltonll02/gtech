"""add pitch-deck fields to businesses and projects

Revision ID: 0029_business_project_pitch
Revises: 0028_quiz_multiselect_timer
Create Date: 2026-08-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY, JSON


revision = "0029_business_project_pitch"
down_revision = "0028_quiz_multiselect_timer"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("businesses", sa.Column("tagline", sa.String(300), nullable=True))
    op.add_column("businesses", sa.Column("industry", sa.String(150), nullable=True))
    op.add_column("businesses", sa.Column("stage", sa.String(50), nullable=True))
    op.add_column("businesses", sa.Column("founded_year", sa.String(10), nullable=True))
    op.add_column("businesses", sa.Column("location", sa.String(255), nullable=True))
    op.add_column("businesses", sa.Column("pitch_summary", sa.Text(), nullable=True))
    op.add_column("businesses", sa.Column("problem_statement", sa.Text(), nullable=True))
    op.add_column("businesses", sa.Column("solution", sa.Text(), nullable=True))
    op.add_column("businesses", sa.Column("gallery_urls", ARRAY(sa.String()), nullable=False, server_default="{}"))
    op.add_column("businesses", sa.Column("contact_email", sa.String(255), nullable=True))
    op.add_column("businesses", sa.Column("is_seeking_investment", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("businesses", sa.Column("investment_ask", sa.Text(), nullable=True))

    op.add_column("projects", sa.Column("tagline", sa.String(300), nullable=True))
    op.add_column("projects", sa.Column("status", sa.String(50), nullable=False, server_default="in_progress"))
    op.add_column("projects", sa.Column("pitch_summary", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("problem_statement", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("solution", sa.Text(), nullable=True))
    op.add_column("projects", sa.Column("collaborators", JSON(), nullable=False, server_default="[]"))
    op.add_column("projects", sa.Column("gallery_urls", ARRAY(sa.String()), nullable=False, server_default="{}"))
    op.add_column("projects", sa.Column("looking_for", sa.Text(), nullable=True))


def downgrade() -> None:
    for col in ["tagline", "status", "pitch_summary", "problem_statement", "solution", "collaborators", "gallery_urls", "looking_for"]:
        op.drop_column("projects", col)
    for col in [
        "tagline", "industry", "stage", "founded_year", "location", "pitch_summary",
        "problem_statement", "solution", "gallery_urls", "contact_email",
        "is_seeking_investment", "investment_ask",
    ]:
        op.drop_column("businesses", col)
