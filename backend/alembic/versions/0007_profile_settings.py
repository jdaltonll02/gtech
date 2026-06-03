"""add profile_settings table

Revision ID: 0007_profile_settings
Revises: 0006_quiz_attempts
Create Date: 2025-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = '0007_profile_settings'
down_revision = '0006_quiz_attempts'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'profile_settings',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('eyebrow', sa.String(255), nullable=False, server_default='Personal Portfolio'),
        sa.Column('full_name', sa.String(255), nullable=False, server_default='John Dalton Gibson'),
        sa.Column('title', sa.String(500), nullable=False, server_default='AI/ML Engineer & CMU Graduate Student'),
        sa.Column('subtitle', sa.String(500), nullable=False, server_default='Specializing in Computer Vision, Robotics, and Deep Learning'),
        sa.Column('focus_paragraph_1', sa.Text(), nullable=True),
        sa.Column('focus_paragraph_2', sa.Text(), nullable=True),
        sa.Column('resume_url', sa.String(500), nullable=False, server_default='/resume.pdf'),
        sa.Column('resume_filename', sa.String(255), nullable=False, server_default='John-Dalton-Gibson-Resume.pdf'),
        sa.Column('github_url', sa.String(500), nullable=False, server_default='https://github.com'),
        sa.Column('profile_photo_url', sa.String(500), nullable=True),
        sa.Column('portfolio_eyebrow', sa.String(255), nullable=False, server_default='Portfolio'),
        sa.Column('portfolio_subtitle', sa.String(500), nullable=False, server_default='Explore my work in AI, Machine Learning, and Robotics'),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    # Seed the single default row
    op.execute("""
        INSERT INTO profile_settings (
            id, eyebrow, full_name, title, subtitle,
            focus_paragraph_1, focus_paragraph_2,
            resume_url, resume_filename, github_url,
            profile_photo_url, portfolio_eyebrow, portfolio_subtitle, updated_at
        ) VALUES (
            1,
            'Personal Portfolio',
            'John Dalton Gibson',
            'AI/ML Engineer & CMU Graduate Student',
            'Specializing in Computer Vision, Robotics, and Deep Learning',
            'Designing production-ready digital systems that combine strong interface design with real operational depth.',
            'Working across intelligent applications, platform architecture, learning systems, and tools that help organizations scale without chaos.',
            '/resume.pdf',
            'John-Dalton-Gibson-Resume.pdf',
            'https://github.com',
            NULL,
            'Portfolio',
            'Explore my work in AI, Machine Learning, and Robotics',
            now()
        ) ON CONFLICT (id) DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table('profile_settings')
