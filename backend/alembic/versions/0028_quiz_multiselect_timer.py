"""quiz multi-select and per-question timer

Revision ID: 0028_quiz_multiselect_timer
Revises: 0027_course_access_coupons
Create Date: 2025-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0028_quiz_multiselect_timer'
down_revision = '0027_course_access_coupons'
branch_labels = None
depends_on = None


def upgrade():
    # quiz_questions: add multi-select support
    op.add_column('quiz_questions', sa.Column('is_multi_select', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('quiz_questions', sa.Column('correct_answer_indices', sa.JSON(), nullable=True))

    # assessments: add per-question timer
    op.add_column('assessments', sa.Column('time_per_question_seconds', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('quiz_questions', 'is_multi_select')
    op.drop_column('quiz_questions', 'correct_answer_indices')
    op.drop_column('assessments', 'time_per_question_seconds')
