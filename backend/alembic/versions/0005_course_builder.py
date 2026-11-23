"""add course builder tables

Revision ID: 0005_course_builder
Revises: 0004_verification_skills
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0005_course_builder'
down_revision = '0004_verification_skills'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add parent_id and description to course_sections
    op.add_column('course_sections', sa.Column('parent_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('course_sections', sa.Column('description', sa.Text(), nullable=True))
    op.create_foreign_key(
        'fk_section_parent', 'course_sections', 'course_sections',
        ['parent_id'], ['id'], ondelete='CASCADE'
    )

    # content_blocks
    op.create_table(
        'content_blocks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('block_type', sa.String(20), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('language', sa.String(50), nullable=True),
        sa.Column('video_url', sa.String(1000), nullable=True),
        sa.Column('video_caption', sa.String(500), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('image_url', sa.String(1000), nullable=True),
        sa.Column('image_caption', sa.String(500), nullable=True),
        sa.Column('image_alt', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    # assessments
    op.create_table(
        'assessments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('lesson_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assessment_type', sa.String(20), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('is_mandatory', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('passing_score', sa.Integer(), nullable=True),
        sa.Column('time_limit_minutes', sa.Integer(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    # quiz_questions
    op.create_table(
        'quiz_questions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('assessment_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('assessments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('question_text', sa.Text(), nullable=False),
        sa.Column('options', postgresql.JSON(), nullable=False, server_default='[]'),
        sa.Column('correct_answer_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('explanation', sa.Text(), nullable=True),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    # Update lessons.lesson_type enum to include 'mixed'
    op.execute("ALTER TYPE lessontype ADD VALUE IF NOT EXISTS 'mixed'")


def downgrade() -> None:
    op.drop_table('quiz_questions')
    op.drop_table('assessments')
    op.drop_table('content_blocks')
    op.drop_constraint('fk_section_parent', 'course_sections', type_='foreignkey')
    op.drop_column('course_sections', 'description')
    op.drop_column('course_sections', 'parent_id')
