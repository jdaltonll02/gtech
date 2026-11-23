"""fix missing enum types for content_blocks and course_payments

Revision ID: 0011_fix_enum_types
Revises: 0010_google_oauth
Create Date: 2026-06-03

"""
from alembic import op
import sqlalchemy as sa

revision = '0011_fix_enum_types'
down_revision = '0010_google_oauth'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── contentblocktype ────────────────────────────────────────────────────────
    op.execute("CREATE TYPE contentblocktype AS ENUM ('text', 'video', 'image', 'code')")
    op.execute("ALTER TABLE content_blocks ALTER COLUMN block_type DROP DEFAULT")
    op.execute("""
        ALTER TABLE content_blocks
        ALTER COLUMN block_type TYPE contentblocktype
        USING block_type::contentblocktype
    """)

    # ── coursepaymentstatus ─────────────────────────────────────────────────────
    op.execute("CREATE TYPE coursepaymentstatus AS ENUM ('pending', 'paid', 'failed')")
    op.execute("ALTER TABLE course_payments ALTER COLUMN status DROP DEFAULT")
    op.execute("""
        ALTER TABLE course_payments
        ALTER COLUMN status TYPE coursepaymentstatus
        USING status::coursepaymentstatus
    """)
    op.execute("ALTER TABLE course_payments ALTER COLUMN status SET DEFAULT 'pending'")

    # ── assessmenttype (same pattern, created as VARCHAR in 0005) ───────────────
    op.execute("DO $$ BEGIN CREATE TYPE assessmenttype AS ENUM ('quiz', 'assignment', 'project'); EXCEPTION WHEN duplicate_object THEN null; END $$")
    op.execute("ALTER TABLE assessments ALTER COLUMN assessment_type DROP DEFAULT")
    op.execute("""
        ALTER TABLE assessments
        ALTER COLUMN assessment_type TYPE assessmenttype
        USING assessment_type::assessmenttype
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE assessments ALTER COLUMN assessment_type TYPE VARCHAR(20) USING assessment_type::text")
    op.execute("DROP TYPE IF EXISTS assessmenttype")

    op.execute("ALTER TABLE course_payments ALTER COLUMN status TYPE VARCHAR(20) USING status::text")
    op.execute("DROP TYPE IF EXISTS coursepaymentstatus")

    op.execute("ALTER TABLE content_blocks ALTER COLUMN block_type TYPE VARCHAR(20) USING block_type::text")
    op.execute("DROP TYPE IF EXISTS contentblocktype")
