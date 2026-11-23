"""lesson comments (per-lesson discussion)

Revision ID: 0025_lesson_comments
Revises: 0024_course_instructors
Create Date: 2026-07-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision = "0025_lesson_comments"
down_revision = "0024_course_instructors"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lesson_comments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("lesson_id", UUID(as_uuid=True), sa.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("parent_comment_id", UUID(as_uuid=True), sa.ForeignKey("lesson_comments.id", ondelete="CASCADE"), nullable=True),
        sa.Column("author_name", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_instructor_reply", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_lesson_comments_lesson_id", "lesson_comments", ["lesson_id"])
    op.create_index("ix_lesson_comments_parent_comment_id", "lesson_comments", ["parent_comment_id"])


def downgrade() -> None:
    op.drop_index("ix_lesson_comments_parent_comment_id", table_name="lesson_comments")
    op.drop_index("ix_lesson_comments_lesson_id", table_name="lesson_comments")
    op.drop_table("lesson_comments")
