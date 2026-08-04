"""badge composite unique constraint (allow multiple badge types per enrollment)

Revision ID: 0026_badge_composite_unique
Revises: 0025_lesson_comments
Create Date: 2026-07-13

Badge.enrollment_id was unique=True, which physically prevents more than one
badge ever existing per enrollment. That blocks awarding e.g. course_completion
and speed_learner off the same completion event. Replace it with a composite
unique constraint on (enrollment_id, badge_type) — still prevents duplicate
awards of the same badge type, but allows multiple types per enrollment.

Safe to run as-is: production has exactly one badge_type ("course_completion")
today, so no existing rows can violate the new composite constraint.
"""
from alembic import op


revision = "0026_badge_composite_unique"
down_revision = "0025_lesson_comments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("badges_enrollment_id_key", "badges", type_="unique")
    op.create_index("ix_badges_enrollment_id", "badges", ["enrollment_id"])
    op.create_unique_constraint("uq_badge_enrollment_type", "badges", ["enrollment_id", "badge_type"])


def downgrade() -> None:
    op.drop_constraint("uq_badge_enrollment_type", "badges", type_="unique")
    op.drop_index("ix_badges_enrollment_id", table_name="badges")
    op.create_unique_constraint("badges_enrollment_id_key", "badges", ["enrollment_id"])
