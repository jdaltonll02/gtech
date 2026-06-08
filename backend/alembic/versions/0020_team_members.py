"""add team members tables

Revision ID: 0020_team_members
Revises: 0019_user_profile_fields
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY

revision = "0020_team_members"
down_revision = "0019_user_profile_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "team_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("bio", sa.Text, nullable=True),
        sa.Column("photo_url", sa.String(500), nullable=True),
        sa.Column("headline", sa.String(255), nullable=True),
        sa.Column("display_order", sa.Integer, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("twitter_url", sa.String(500), nullable=True),
        sa.Column("github_url", sa.String(500), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_team_members_slug", "team_members", ["slug"])

    op.create_table(
        "team_member_experiences",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("team_member_id", UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("company", sa.String(255), nullable=False),
        sa.Column("position", sa.String(255), nullable=False),
        sa.Column("duration", sa.String(100), nullable=False),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_team_member_experiences_member", "team_member_experiences", ["team_member_id"])

    op.create_table(
        "team_member_educations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("team_member_id", UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("institution", sa.String(255), nullable=False),
        sa.Column("degree", sa.String(255), nullable=False),
        sa.Column("field_of_study", sa.String(255), nullable=False),
        sa.Column("start_year", sa.String(10), nullable=False),
        sa.Column("end_year", sa.String(10), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_team_member_educations_member", "team_member_educations", ["team_member_id"])

    op.create_table(
        "team_member_projects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("team_member_id", UUID(as_uuid=True), sa.ForeignKey("team_members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("tech_stack", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("github_url", sa.String(500), nullable=True),
        sa.Column("live_url", sa.String(500), nullable=True),
        sa.Column("image_url", sa.String(500), nullable=True),
        sa.Column("order_index", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_index("ix_team_member_projects_member", "team_member_projects", ["team_member_id"])


def downgrade() -> None:
    op.drop_table("team_member_projects")
    op.drop_table("team_member_educations")
    op.drop_table("team_member_experiences")
    op.drop_table("team_members")
