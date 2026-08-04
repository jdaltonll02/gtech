"""course prerequisites and drip scheduling

Revision ID: 0023_course_prerequisites_and_drip
Revises: 0022_badges
Create Date: 2026-07-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "0023_course_prereqs_drip"
down_revision = "0022_badges"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "course_prerequisites",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("course_id", UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("prerequisite_course_id", UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("course_id", "prerequisite_course_id", name="uq_course_prerequisite"),
    )
    op.create_index("ix_course_prerequisites_course_id", "course_prerequisites", ["course_id"])

    op.add_column("lessons", sa.Column("available_after_days", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("lessons", "available_after_days")
    op.drop_index("ix_course_prerequisites_course_id", table_name="course_prerequisites")
    op.drop_table("course_prerequisites")
