"""Tests for team-member organizational projects (GET /team/projects/organizational)."""
import uuid
from unittest.mock import AsyncMock, MagicMock
import pytest

from app.api.v1.endpoints.team import list_organizational_projects


def _make_member(**kwargs):
    m = MagicMock()
    m.id = uuid.uuid4()
    m.full_name = "Jane Doe"
    m.slug = "jane-doe"
    m.photo_url = None
    m.is_active = True
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


def _make_project(**kwargs):
    m = MagicMock()
    m.id = uuid.uuid4()
    m.team_member_id = uuid.uuid4()
    m.title = "AI Tutor"
    m.description = "An AI-powered tutor."
    m.tech_stack = ["Python", "FastAPI"]
    m.github_url = None
    m.live_url = None
    m.image_url = None
    m.order_index = 0
    m.is_organizational = True
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


@pytest.mark.asyncio
async def test_list_organizational_projects_returns_contributor_attribution():
    member = _make_member()
    project = _make_project(team_member_id=member.id)

    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = [(project, member)]
    db.execute = AsyncMock(return_value=result)

    projects = await list_organizational_projects(db=db)

    assert len(projects) == 1
    assert projects[0].contributor_name == "Jane Doe"
    assert projects[0].contributor_slug == "jane-doe"
    assert projects[0].title == "AI Tutor"
    assert projects[0].is_organizational is True


@pytest.mark.asyncio
async def test_list_organizational_projects_empty_when_none_flagged():
    db = AsyncMock()
    result = MagicMock()
    result.all.return_value = []
    db.execute = AsyncMock(return_value=result)

    projects = await list_organizational_projects(db=db)
    assert projects == []
