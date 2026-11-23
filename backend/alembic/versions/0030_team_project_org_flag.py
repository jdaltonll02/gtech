"""add is_organizational flag to team_member_projects

Revision ID: 0030_team_project_org_flag
Revises: 0029_business_project_pitch
Create Date: 2026-08-04

"""
from alembic import op
import sqlalchemy as sa


revision = "0030_team_project_org_flag"
down_revision = "0029_business_project_pitch"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "team_member_projects",
        sa.Column("is_organizational", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("team_member_projects", "is_organizational")
