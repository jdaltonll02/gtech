"""add quiz attempts table

Revision ID: 0006_quiz_attempts
Revises: 0005_course_builder
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0006_quiz_attempts'
down_revision = '0005_course_builder'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'quiz_attempts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('enrollment_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('enrollments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assessment_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('answers', postgresql.JSON(), nullable=False, server_default='[]'),
        sa.Column('score_percent', sa.Float(), nullable=False, server_default='0'),
        sa.Column('passed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text('now()')),
    )
    op.create_index('ix_quiz_attempts_enrollment_assessment',
                    'quiz_attempts', ['enrollment_id', 'assessment_id'])


def downgrade() -> None:
    op.drop_index('ix_quiz_attempts_enrollment_assessment', table_name='quiz_attempts')
    op.drop_table('quiz_attempts')
