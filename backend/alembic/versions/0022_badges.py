"""badges

Revision ID: 0022_badges
Revises: 0021_team_member_certifications
Create Date: 2026-06-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "0022_badges"
down_revision = "0021_team_member_certifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "badges",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("enrollment_id", UUID(as_uuid=True), sa.ForeignKey("enrollments.id", ondelete="CASCADE"), unique=True, nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("badge_type", sa.String(50), nullable=False, server_default="course_completion"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_badges_user_id", "badges", ["user_id"])
    op.create_index("ix_badges_course_id", "badges", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_badges_course_id", table_name="badges")
    op.drop_index("ix_badges_user_id", table_name="badges")
    op.drop_table("badges")
