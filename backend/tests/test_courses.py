"""Tests for the new course features: drip scheduling, instructor scoping, weighted progress."""
import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.courses import _check_drip_lock, _recalculate_progress, submit_quiz
from app.api.deps import ensure_course_access, get_user_assigned_course_ids
from app.models.user import UserRole
from app.schemas.courses import QuizSubmit
from tests.conftest import make_user, mock_db_result


def _make_question(**kwargs):
    m = MagicMock()
    m.question_text = "Q?"
    m.options = ["A", "B", "C", "D"]
    m.correct_answer_index = 0
    m.correct_answer_indices = None
    m.is_multi_select = False
    m.explanation = None
    m.order_index = 0
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


def _make_assessment(questions, **kwargs):
    m = MagicMock()
    m.id = uuid.uuid4()
    m.assessment_type = "quiz"
    m.lesson_id = uuid.uuid4()
    m.passing_score = 70
    m.questions = questions
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


def _make_lesson(**kwargs):
    m = MagicMock()
    m.is_preview = False
    m.available_after_days = None
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


def _make_enrollment(**kwargs):
    m = MagicMock()
    m.id = uuid.uuid4()
    m.course_id = uuid.uuid4()
    m.enrolled_at = datetime.now(timezone.utc)
    for k, v in kwargs.items():
        setattr(m, k, v)
    return m


# ── Drip scheduling ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_drip_lock_blocks_before_unlock_date():
    lesson = _make_lesson(available_after_days=3)
    enrollment = _make_enrollment(enrolled_at=datetime.now(timezone.utc))
    with pytest.raises(HTTPException) as exc:
        await _check_drip_lock(lesson, enrollment)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_drip_lock_allows_after_unlock_date():
    lesson = _make_lesson(available_after_days=3)
    enrollment = _make_enrollment(enrolled_at=datetime.now(timezone.utc) - timedelta(days=4))
    await _check_drip_lock(lesson, enrollment)  # should not raise


@pytest.mark.asyncio
async def test_drip_lock_skips_preview_lessons():
    lesson = _make_lesson(is_preview=True, available_after_days=30)
    enrollment = _make_enrollment(enrolled_at=datetime.now(timezone.utc))
    await _check_drip_lock(lesson, enrollment)  # preview bypasses drip-lock entirely


@pytest.mark.asyncio
async def test_drip_lock_skips_when_unset():
    lesson = _make_lesson(available_after_days=None)
    enrollment = _make_enrollment(enrolled_at=datetime.now(timezone.utc))
    await _check_drip_lock(lesson, enrollment)  # no schedule set — always available


# ── Row-level instructor access (ensure_course_access) ────────────────────────

@pytest.mark.asyncio
async def test_ensure_course_access_allows_admin():
    admin = make_user(role=UserRole.ADMIN)
    db = AsyncMock()
    await ensure_course_access(uuid.uuid4(), admin, db)  # should not raise, no DB call needed


@pytest.mark.asyncio
async def test_get_user_assigned_course_ids_full_access_for_superadmin_with_no_staff_role():
    """Regression test: the primary superadmin (or admin) typically has zero
    UserStaffRole rows — RBAC assignments are for staff/instructor accounts,
    not the seeded superadmin. get_user_assigned_course_ids must return None
    (full access) for them without ever touching the DB, not [] (no access),
    which previously hid every course from list_courses_admin for any
    admin/superadmin lacking an explicit RBAC assignment."""
    superadmin = make_user(role=UserRole.SUPERADMIN)
    db = AsyncMock()
    result = await get_user_assigned_course_ids(superadmin, db)
    assert result is None
    db.execute.assert_not_called()


@pytest.mark.asyncio
async def test_ensure_course_access_allows_full_manage_courses():
    user = make_user(role=UserRole.USER)
    db = AsyncMock()
    with patch("app.api.deps.get_user_assigned_course_ids", new=AsyncMock(return_value=None)):
        await ensure_course_access(uuid.uuid4(), user, db)  # None == full access, should not raise


@pytest.mark.asyncio
async def test_ensure_course_access_blocks_unassigned_instructor():
    user = make_user(role=UserRole.USER)
    course_id = uuid.uuid4()
    other_course_id = uuid.uuid4()
    db = AsyncMock()
    with patch("app.api.deps.get_user_assigned_course_ids", new=AsyncMock(return_value=[other_course_id])):
        with pytest.raises(HTTPException) as exc:
            await ensure_course_access(course_id, user, db)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_ensure_course_access_allows_assigned_instructor():
    user = make_user(role=UserRole.USER)
    course_id = uuid.uuid4()
    db = AsyncMock()
    with patch("app.api.deps.get_user_assigned_course_ids", new=AsyncMock(return_value=[course_id])):
        await ensure_course_access(course_id, user, db)  # should not raise


# ── Weighted progress calculation ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_recalculate_progress_weights_by_duration():
    enrollment = _make_enrollment()
    db = AsyncMock()
    # total_weight = 1200s across all lessons, completed_weight = 300s so far -> 25%
    db.scalar = AsyncMock(side_effect=[1200, 300])
    result = await _recalculate_progress(enrollment, db)
    assert result == 25.0


@pytest.mark.asyncio
async def test_recalculate_progress_zero_when_no_lessons():
    enrollment = _make_enrollment()
    db = AsyncMock()
    db.scalar = AsyncMock(side_effect=[0])
    result = await _recalculate_progress(enrollment, db)
    assert result == 0.0


# ── Quiz submission (regression: QuizAttemptResponse.answers type mismatch) ───
# submit_quiz always wraps each answer as a list (e.g. single-select 3 -> [3])
# before persisting; QuizAttemptResponse.answers must accept list[list[int]],
# not list[int], or every quiz submission crashes with a Pydantic
# ResponseValidationError after the attempt is already written to the DB.

@pytest.mark.asyncio
async def test_submit_quiz_single_select_builds_response_without_crashing():
    question = _make_question(is_multi_select=False, correct_answer_index=3)
    assessment = _make_assessment([question])
    lesson = _make_lesson(section_id=uuid.uuid4())
    section = MagicMock(course_id=uuid.uuid4())
    enrollment = _make_enrollment(course_id=section.course_id, status="active")
    user = make_user()

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[
        mock_db_result(assessment), mock_db_result(lesson), mock_db_result(section), mock_db_result(enrollment),
    ])
    db.scalar = AsyncMock(return_value=0)
    # SQLAlchemy applies id/submitted_at column defaults during a real flush;
    # since flush is mocked, inject them the same way test_auth.py does for
    # the analogous User-creation case.
    db.add = MagicMock(side_effect=lambda obj: obj.__dict__.update({
        "id": uuid.uuid4(), "submitted_at": datetime.now(timezone.utc), "attempt_number": 1,
    }))

    result = await submit_quiz(assessment_id=assessment.id, payload=QuizSubmit(answers=[3]), db=db, current_user=user)
    assert result.score_percent == 100.0
    assert result.passed is True
    assert result.answers == [[3]]


@pytest.mark.asyncio
async def test_submit_quiz_multi_select_builds_response_without_crashing():
    question = _make_question(is_multi_select=True, correct_answer_indices=[1, 3])
    assessment = _make_assessment([question])
    lesson = _make_lesson(section_id=uuid.uuid4())
    section = MagicMock(course_id=uuid.uuid4())
    enrollment = _make_enrollment(course_id=section.course_id, status="active")
    user = make_user()

    db = AsyncMock()
    db.execute = AsyncMock(side_effect=[
        mock_db_result(assessment), mock_db_result(lesson), mock_db_result(section), mock_db_result(enrollment),
    ])
    db.scalar = AsyncMock(return_value=0)
    # SQLAlchemy applies id/submitted_at column defaults during a real flush;
    # since flush is mocked, inject them the same way test_auth.py does for
    # the analogous User-creation case.
    db.add = MagicMock(side_effect=lambda obj: obj.__dict__.update({
        "id": uuid.uuid4(), "submitted_at": datetime.now(timezone.utc), "attempt_number": 1,
    }))

    result = await submit_quiz(assessment_id=assessment.id, payload=QuizSubmit(answers=[[1, 3]]), db=db, current_user=user)
    assert result.score_percent == 100.0
    assert result.passed is True
    assert result.answers == [[1, 3]]
