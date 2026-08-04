"""course instructors

Revision ID: 0024_course_instructors
Revises: 0023_course_prerequisites_and_drip
Create Date: 2026-07-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "0024_course_instructors"
down_revision = "0023_course_prereqs_drip"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "course_instructors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", UUID(as_uuid=True), sa.ForeignKey("courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "course_id", name="uq_course_instructor"),
    )
    op.create_index("ix_course_instructors_user_id", "course_instructors", ["user_id"])
    op.create_index("ix_course_instructors_course_id", "course_instructors", ["course_id"])


def downgrade() -> None:
    op.drop_index("ix_course_instructors_course_id", table_name="course_instructors")
    op.drop_index("ix_course_instructors_user_id", table_name="course_instructors")
    op.drop_table("course_instructors")
