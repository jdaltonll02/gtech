import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.api.deps import AdminUser, CurrentUser, DB
from app.models.courses import (
    Assessment, Certificate, ContentBlock, Course, CoursePayment, CoursePaymentStatus,
    Enrollment, EnrollmentStatus,
    Lesson, LessonProgress, QuizQuestion, Section,
)
from app.models.quiz_attempt import QuizAttempt
from app.models.user import User
from app.schemas.courses import (
    AssessmentCreate, AssessmentResponse, AssessmentUpdate,
    CertificateResponse, CertificatePublicResponse, ContentBlockCreate, ContentBlockResponse, ContentBlockUpdate,
    ConfirmCoursePaymentRequest, CourseCreate, CourseDetailResponse, CourseListResponse, CoursePaymentIntentResponse, CourseUpdate,
    EnrollmentResponse, EnrollmentAdminResponse, LessonCreate, LessonDetailResponse, LessonProgressResponse,
    LessonUpdate, ProgressUpdate, QuizQuestionCreate, QuizQuestionResponse, QuizQuestionUpdate,
    QuizSubmit, QuizAttemptResponse,
    ReorderItem, ReorderRequest,
    SectionCreate, SectionResponse, SectionUpdate,
)

router = APIRouter(prefix="/courses", tags=["courses"])


def _cert_number(user_id: uuid.UUID, course_id: uuid.UUID) -> str:
    import hashlib
    raw = f"{user_id}-{course_id}-{datetime.now(timezone.utc).isoformat()}"
    return "CERT-" + hashlib.sha1(raw.encode()).hexdigest()[:12].upper()


async def _recalculate_progress(enrollment: Enrollment, db) -> float:
    """Recompute progress_percent from completed lessons vs total lessons in course."""
    total = await db.scalar(
        select(func.count(Lesson.id))
        .join(Section, Lesson.section_id == Section.id)
        .where(Section.course_id == enrollment.course_id)
    )
    if not total:
        return 0.0
    completed = await db.scalar(
        select(func.count(LessonProgress.id))
        .where(
            LessonProgress.enrollment_id == enrollment.id,
            LessonProgress.is_completed == True,
        )
    )
    return round((completed / total) * 100, 1)


async def _get_enrollment_count(course_id: uuid.UUID, db) -> int:
    """Get number of active enrollments for a course."""
    count = await db.scalar(
        select(func.count(Enrollment.id)).where(
            Enrollment.course_id == course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
    )
    return count or 0


def _add_enrollment_count(course: Course, enrollment_count: int) -> dict:
    """Convert course ORM to dict with enrollment_count."""
    data = {k: getattr(course, k) for k in ['id','title','slug','short_description','thumbnail_url','level','price','is_free','is_published','estimated_hours','tags','instructor_name']}
    data['enrollment_count'] = enrollment_count
    return data


# ════════════════════════════════════════════════════════════════════════════════
# ══ SPECIFIC ROUTES (ordered before wildcard /{course_id}) ══════════════════════
# ════════════════════════════════════════════════════════════════════════════════

# ── Course Catalog (public) ───────────────────────────────────────────────────

@router.get("/", response_model=List[CourseListResponse])
async def list_courses(
    db: DB,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    level: Optional[str] = None,
    tags: Optional[str] = None,
):
    """List published courses with optional search, level, and tags filters."""
    query = select(Course).where(Course.is_published == True)
    
    if search:
        query = query.where(
            or_(
                Course.title.ilike(f"%{search}%"),
                Course.description.ilike(f"%{search}%"),
            )
        )
    
    if level:
        query = query.where(Course.level == level)
    
    if tags:
        # tags is comma-separated; match any tag
        tag_list = [t.strip() for t in tags.split(',')]
        query = query.where(
            or_(*[Course.tags.ilike(f"%{tag}%") for tag in tag_list])
        )
    
    result = await db.execute(query.offset(skip).limit(limit))
    courses = result.scalars().all()
    
    # Add enrollment counts
    response = []
    for course in courses:
        count = await _get_enrollment_count(course.id, db)
        data = _add_enrollment_count(course, count)
        response.append(CourseListResponse(**data))
    
    return response


@router.post("/", response_model=CourseListResponse, status_code=201)
async def create_course(payload: CourseCreate, db: DB, _: AdminUser):
    obj = Course(**payload.model_dump())
    db.add(obj)
    await db.flush()
    data = _add_enrollment_count(obj, 0)
    return CourseListResponse(**data)


# ── Admin routes ──────────────────────────────────────────────────────────────

@router.get("/admin/all", response_model=List[CourseListResponse])
async def list_courses_admin(db: DB, _: AdminUser, skip: int = 0, limit: int = 200):
    result = await db.execute(select(Course).offset(skip).limit(limit))
    courses = result.scalars().all()
    
    # Add enrollment counts
    response = []
    for course in courses:
        count = await _get_enrollment_count(course.id, db)
        data = _add_enrollment_count(course, count)
        response.append(CourseListResponse(**data))
    
    return response


@router.get("/admin/{course_id}", response_model=CourseDetailResponse)
async def get_course_admin(course_id: uuid.UUID, db: DB, _: AdminUser):
    # Load course
    course_result = await db.execute(select(Course).where(Course.id == course_id))
    course = course_result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Load all sections for this course (flat, ordered)
    # Build properly nested eager loading for recursive subsections
    sections_result = await db.execute(
        select(Section)
        .options(
            selectinload(Section.lessons)
            .selectinload(Lesson.content_blocks),
            selectinload(Section.lessons)
            .selectinload(Lesson.assessments)
            .selectinload(Assessment.questions),
        )
        .where(Section.course_id == course_id, Section.parent_id == None)
        .order_by(Section.order_index)
    )
    top_sections = sections_result.scalars().all()

    # Recursively load all subsections with their lessons
    async def load_subsections(section_ids: list):
        """Recursively load subsections with their lessons and content."""
        if not section_ids:
            return {}
        
        result = await db.execute(
            select(Section)
            .options(
                selectinload(Section.lessons)
                .selectinload(Lesson.content_blocks),
                selectinload(Section.lessons)
                .selectinload(Lesson.assessments)
                .selectinload(Assessment.questions),
            )
            .where(Section.parent_id.in_(section_ids))
            .order_by(Section.order_index)
        )
        subsections = result.scalars().all()
        
        # Map subsections by parent_id
        subsections_by_parent = {}
        for sub in subsections:
            if sub.parent_id not in subsections_by_parent:
                subsections_by_parent[sub.parent_id] = []
            subsections_by_parent[sub.parent_id].append(sub)
        
        # Recursively load deeper subsections
        if subsections:
            sub_ids = [s.id for s in subsections]
            deeper = await load_subsections(sub_ids)
            for sub in subsections:
                sub._deeper_subs = deeper.get(sub.id, [])
        
        return subsections_by_parent

    # Load all nested subsections
    all_subs = await load_subsections([s.id for s in top_sections])
    
    # Build response dict manually to avoid lazy-load issues
    from app.schemas.courses import SectionResponse, LessonDetailResponse, ContentBlockResponse, AssessmentResponse, QuizQuestionResponse

    def build_lesson(l):
        return LessonDetailResponse(
            id=l.id, section_id=l.section_id, title=l.title,
            lesson_type=l.lesson_type, order_index=l.order_index,
            duration_seconds=l.duration_seconds, is_preview=l.is_preview,
            video_url=l.video_url, content=l.content,
            content_blocks=[ContentBlockResponse.model_validate(b) for b in l.content_blocks],
            assessments=[
                AssessmentResponse(
                    **{k: getattr(a, k) for k in ['id','lesson_id','assessment_type','title','description','instructions','is_mandatory','passing_score','time_limit_minutes','order_index']},
                    questions=[QuizQuestionResponse.model_validate(q) for q in a.questions]
                ) for a in l.assessments
            ],
        )

    def build_section(s):
        # Get pre-loaded subsections
        subs = all_subs.get(s.id, [])
        return SectionResponse(
            id=s.id, course_id=s.course_id, parent_id=s.parent_id,
            title=s.title, description=s.description, order_index=s.order_index,
            lessons=[build_lesson(l) for l in s.lessons],
            sub_sections=[build_section(sub) for sub in subs],
        )

    enrollment_count = await _get_enrollment_count(course_id, db)
    
    return CourseDetailResponse(
        id=course.id, title=course.title, slug=course.slug,
        description=course.description, short_description=course.short_description,
        thumbnail_url=course.thumbnail_url, level=course.level,
        price=course.price, is_free=course.is_free, is_published=course.is_published,
        estimated_hours=course.estimated_hours, tags=course.tags,
        instructor_name=course.instructor_name,
        enrollment_count=enrollment_count,
        sections=[build_section(s) for s in top_sections],
    )


@router.get("/admin/{course_id}/enrollments", response_model=List[EnrollmentAdminResponse])
async def list_course_enrollments(course_id: uuid.UUID, db: DB, _: AdminUser):
    """List all enrollments for a course."""
    result = await db.execute(
        select(Enrollment)
        .options(selectinload(Enrollment.user))
        .where(Enrollment.course_id == course_id)
        .order_by(Enrollment.enrolled_at.desc())
    )
    enrollments = result.scalars().all()
    
    return [
        EnrollmentAdminResponse(
            id=e.id,
            user_id=e.user_id,
            course_id=e.course_id,
            status=e.status,
            progress_percent=e.progress_percent,
            enrolled_at=e.enrolled_at,
            completed_at=e.completed_at,
            user_email=e.user.email,
            user_name=e.user.full_name or e.user.email,
        )
        for e in enrollments
    ]


@router.delete("/admin/enrollments/{enrollment_id}", status_code=204)
async def unenroll_student(enrollment_id: uuid.UUID, db: DB, _: AdminUser):
    """Remove a student from a course."""
    result = await db.execute(select(Enrollment).where(Enrollment.id == enrollment_id))
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    await db.delete(enrollment)


# ── User routes: My resources ─────────────────────────────────────────────────

@router.get("/my/enrollments", response_model=List[EnrollmentResponse])
async def my_enrollments(db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Enrollment)
        .options(selectinload(Enrollment.course))
        .where(Enrollment.user_id == current_user.id)
        .order_by(Enrollment.enrolled_at.desc())
    )
    enrollments = result.scalars().all()

    response = []
    for e in enrollments:
        course_data = _add_enrollment_count(e.course, 0)  # count not critical here
        response.append(EnrollmentResponse(
            id=e.id,
            course_id=e.course_id,
            status=e.status,
            progress_percent=e.progress_percent,
            last_accessed_lesson_id=e.last_accessed_lesson_id,
            enrolled_at=e.enrolled_at,
            completed_at=e.completed_at,
            course=CourseListResponse(**course_data),
        ))
    return response


@router.get("/my/certificates", response_model=List[CertificateResponse])
async def my_certificates(db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Certificate)
        .options(selectinload(Certificate.course))
        .where(Certificate.user_id == current_user.id)
        .order_by(Certificate.issued_at.desc())
    )
    certs = result.scalars().all()
    return [
        CertificateResponse(
            id=c.id,
            enrollment_id=c.enrollment_id,
            course_id=c.course_id,
            certificate_number=c.certificate_number,
            issued_at=c.issued_at,
            course=CourseListResponse(**_add_enrollment_count(c.course, 0)),
        )
        for c in certs
    ]


# ── Certificate verification (public) ─────────────────────────────────────────

@router.get("/certificates/{cert_number}")
async def verify_certificate(cert_number: str, db: DB):
    """Public endpoint to verify a certificate by its number."""
    result = await db.execute(
        select(Certificate)
        .options(selectinload(Certificate.course), selectinload(Certificate.user))
        .where(Certificate.certificate_number == cert_number)
    )
    cert = result.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {
        "valid": True,
        "certificate_number": cert.certificate_number,
        "course_title": cert.course.title,
        "issued_at": cert.issued_at,
        "recipient_name": cert.user.full_name or cert.user.email,
        "instructor_name": cert.course.instructor_name,
        "estimated_hours": cert.course.estimated_hours,
        "level": cert.course.level,
    }


# ── Content Block routes ──────────────────────────────────────────────────────

@router.get("/lessons/{lesson_id}/blocks", response_model=List[ContentBlockResponse])
async def list_content_blocks(lesson_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(
        select(ContentBlock).where(ContentBlock.lesson_id == lesson_id).order_by(ContentBlock.order_index)
    )
    return result.scalars().all()


@router.post("/lessons/{lesson_id}/blocks", response_model=ContentBlockResponse, status_code=201)
async def create_content_block(lesson_id: uuid.UUID, payload: ContentBlockCreate, db: DB, _: AdminUser):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Lesson not found")
    obj = ContentBlock(lesson_id=lesson_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/blocks/{block_id}", response_model=ContentBlockResponse)
async def update_content_block(block_id: uuid.UUID, payload: ContentBlockUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(ContentBlock).where(ContentBlock.id == block_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Content block not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/blocks/{block_id}", status_code=204)
async def delete_content_block(block_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(ContentBlock).where(ContentBlock.id == block_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Content block not found")
    await db.delete(obj)


# ── Assessment routes ─────────────────────────────────────────────────────────

@router.get("/lessons/{lesson_id}/assessments", response_model=List[AssessmentResponse])
async def list_assessments(lesson_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(
        select(Assessment)
        .options(selectinload(Assessment.questions))
        .where(Assessment.lesson_id == lesson_id)
        .order_by(Assessment.order_index)
    )
    return result.scalars().all()


@router.post("/lessons/{lesson_id}/assessments", response_model=AssessmentResponse, status_code=201)
async def create_assessment(lesson_id: uuid.UUID, payload: AssessmentCreate, db: DB, _: AdminUser):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Lesson not found")
    obj = Assessment(lesson_id=lesson_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj, ["questions"])
    return obj


@router.patch("/assessments/{assessment_id}", response_model=AssessmentResponse)
async def update_assessment(assessment_id: uuid.UUID, payload: AssessmentUpdate, db: DB, _: AdminUser):
    result = await db.execute(
        select(Assessment).options(selectinload(Assessment.questions)).where(Assessment.id == assessment_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Assessment not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/assessments/{assessment_id}", status_code=204)
async def delete_assessment(assessment_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Assessment not found")
    await db.delete(obj)


@router.post("/assessments/{assessment_id}/submit", response_model=QuizAttemptResponse)
async def submit_quiz(assessment_id: uuid.UUID, payload: QuizSubmit, db: DB, current_user: CurrentUser):
    """Submit quiz answers and get score."""
    # Load assessment with questions
    assessment_result = await db.execute(
        select(Assessment)
        .options(selectinload(Assessment.questions))
        .where(Assessment.id == assessment_id)
    )
    assessment = assessment_result.scalar_one_or_none()
    if not assessment or assessment.assessment_type != "quiz":
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Check enrollment
    lesson_result = await db.execute(select(Lesson).where(Lesson.id == assessment.lesson_id))
    lesson = lesson_result.scalar_one_or_none()
    section_result = await db.execute(select(Section).where(Section.id == lesson.section_id))
    section = section_result.scalar_one_or_none()
    
    enrollment_result = await db.execute(
        select(Enrollment).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == section.course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
    )
    enrollment = enrollment_result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")

    # Score the quiz
    questions = sorted(assessment.questions, key=lambda q: q.order_index)
    score = 0
    results = []
    
    for idx, q in enumerate(questions):
        user_answer = payload.answers[idx] if idx < len(payload.answers) else None
        is_correct = user_answer == q.correct_answer_index
        if is_correct:
            score += 1
        results.append({
            "question_text": q.question_text,
            "your_answer": q.options[user_answer] if user_answer is not None else None,
            "correct_answer": q.options[q.correct_answer_index],
            "correct": is_correct,
            "explanation": q.explanation or "",
        })
    
    score_percent = round((score / len(questions) * 100)) if questions else 0
    passed = score_percent >= (assessment.passing_score or 70)

    # Get or create attempt
    attempt_count = await db.scalar(
        select(func.count(QuizAttempt.id)).where(
            QuizAttempt.enrollment_id == enrollment.id,
            QuizAttempt.assessment_id == assessment_id,
        )
    ) or 0

    attempt = QuizAttempt(
        enrollment_id=enrollment.id,
        assessment_id=assessment_id,
        user_id=current_user.id,
        answers=payload.answers,
        score_percent=float(score_percent),
        passed=passed,
        attempt_number=attempt_count + 1,
    )
    db.add(attempt)
    await db.flush()

    return QuizAttemptResponse(
        id=attempt.id,
        assessment_id=assessment_id,
        score_percent=float(score_percent),
        passed=passed,
        attempt_number=attempt.attempt_number,
        answers=payload.answers,
        submitted_at=attempt.submitted_at,
        results=results,
    )


# ── Quiz Question routes ──────────────────────────────────────────────────────

@router.post("/assessments/{assessment_id}/questions", response_model=QuizQuestionResponse, status_code=201)
async def create_quiz_question(assessment_id: uuid.UUID, payload: QuizQuestionCreate, db: DB, _: AdminUser):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Assessment not found")
    obj = QuizQuestion(assessment_id=assessment_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/questions/{question_id}", response_model=QuizQuestionResponse)
async def update_quiz_question(question_id: uuid.UUID, payload: QuizQuestionUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(QuizQuestion).where(QuizQuestion.id == question_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Question not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/questions/{question_id}", status_code=204)
async def delete_quiz_question(question_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(QuizQuestion).where(QuizQuestion.id == question_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(obj)


# ── Section routes ────────────────────────────────────────────────────────────

@router.post("/sections/{section_id}/lessons", response_model=LessonDetailResponse, status_code=201)
async def create_lesson(section_id: uuid.UUID, payload: LessonCreate, db: DB, _: AdminUser):
    result = await db.execute(select(Section).where(Section.id == section_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Section not found")
    obj = Lesson(section_id=section_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    return LessonDetailResponse(
        id=obj.id, section_id=obj.section_id, title=obj.title,
        lesson_type=obj.lesson_type, order_index=obj.order_index,
        duration_seconds=obj.duration_seconds, is_preview=obj.is_preview,
        video_url=obj.video_url, content=obj.content,
        content_blocks=[], assessments=[],
    )


@router.patch("/sections/{section_id}", response_model=SectionResponse)
async def update_section(section_id: uuid.UUID, payload: SectionUpdate, db: DB, _: AdminUser):
    result = await db.execute(
        select(Section)
        .options(selectinload(Section.lessons), selectinload(Section.sub_sections))
        .where(Section.id == section_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Section not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    from app.schemas.courses import LessonResponse
    return SectionResponse(
        id=obj.id, course_id=obj.course_id, parent_id=obj.parent_id,
        title=obj.title, description=obj.description, order_index=obj.order_index,
        lessons=[LessonResponse.model_validate(l) for l in obj.lessons],
        sub_sections=[],
    )


@router.delete("/sections/{section_id}", status_code=204)
async def delete_section(section_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Section).where(Section.id == section_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(obj)


@router.patch("/sections/{section_id}/lessons/reorder", status_code=204)
async def reorder_lessons(section_id: uuid.UUID, payload: ReorderRequest, db: DB, _: AdminUser):
    """Reorder lessons within a section."""
    for item in payload.items:
        result = await db.execute(
            select(Lesson).where(Lesson.id == item.id, Lesson.section_id == section_id)
        )
        lesson = result.scalar_one_or_none()
        if lesson:
            lesson.order_index = item.order_index
    await db.flush()


# ── Lesson routes (admin) ─────────────────────────────────────────────────────

@router.patch("/lessons/{lesson_id}", response_model=LessonDetailResponse)
async def update_lesson(lesson_id: uuid.UUID, payload: LessonUpdate, db: DB, _: AdminUser):
    result = await db.execute(
        select(Lesson)
        .options(selectinload(Lesson.content_blocks), selectinload(Lesson.assessments).selectinload(Assessment.questions))
        .where(Lesson.id == lesson_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Lesson not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    from app.schemas.courses import ContentBlockResponse, AssessmentResponse, QuizQuestionResponse
    return LessonDetailResponse(
        id=obj.id, section_id=obj.section_id, title=obj.title,
        lesson_type=obj.lesson_type, order_index=obj.order_index,
        duration_seconds=obj.duration_seconds, is_preview=obj.is_preview,
        video_url=obj.video_url, content=obj.content,
        content_blocks=[ContentBlockResponse.model_validate(b) for b in obj.content_blocks],
        assessments=[
            AssessmentResponse(
                **{k: getattr(a, k) for k in ['id','lesson_id','assessment_type','title','description','instructions','is_mandatory','passing_score','time_limit_minutes','order_index']},
                questions=[QuizQuestionResponse.model_validate(q) for q in a.questions]
            ) for a in obj.assessments
        ],
    )


@router.delete("/lessons/{lesson_id}", status_code=204)
async def delete_lesson(lesson_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Lesson not found")
    await db.delete(obj)


# ════════════════════════════════════════════════════════════════════════════════
# ══ COURSE-SPECIFIC ROUTES (before wildcard /{course_id}) ═════════════════════
# ════════════════════════════════════════════════════════════════════════════════

@router.post("/{course_id}/sections", response_model=SectionResponse, status_code=201)
async def create_section(course_id: uuid.UUID, payload: SectionCreate, db: DB, _: AdminUser):
    result = await db.execute(select(Course).where(Course.id == course_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")
    obj = Section(course_id=course_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj, ["lessons", "sub_sections"])
    return SectionResponse(
        id=obj.id, course_id=obj.course_id, parent_id=obj.parent_id,
        title=obj.title, description=obj.description, order_index=obj.order_index,
        lessons=[], sub_sections=[],
    )


@router.patch("/{course_id}/sections/reorder", status_code=204)
async def reorder_sections(course_id: uuid.UUID, payload: ReorderRequest, db: DB, _: AdminUser):
    """Reorder sections within a course."""
    for item in payload.items:
        result = await db.execute(
            select(Section).where(Section.id == item.id, Section.course_id == course_id)
        )
        section = result.scalar_one_or_none()
        if section:
            section.order_index = item.order_index
    await db.flush()


async def _create_enrollment(course: Course, user_id: uuid.UUID, db) -> Enrollment:
    """Create an enrollment record. Caller is responsible for the duplicate check."""
    enrollment = Enrollment(user_id=user_id, course_id=course.id)
    db.add(enrollment)
    await db.flush()
    return enrollment


@router.post("/{course_id}/enroll", response_model=EnrollmentResponse, status_code=201)
async def enroll(course_id: uuid.UUID, db: DB, current_user: CurrentUser):
    """Enroll in a course.
    - Free courses: allowed immediately.
    - Paid courses: requires a confirmed CoursePayment (call /payment-intent then
      /confirm-payment first).  Admins bypass the payment check.
    """
    result = await db.execute(select(Course).where(Course.id == course_id, Course.is_published == True))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    existing = await db.execute(
        select(Enrollment).where(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Already enrolled")

    # Payment gate: paid courses require a confirmed payment (admins are exempt)
    if not course.is_free and current_user.role not in ("admin", "superadmin"):
        paid = await db.execute(
            select(CoursePayment).where(
                CoursePayment.user_id == current_user.id,
                CoursePayment.course_id == course_id,
                CoursePayment.status == CoursePaymentStatus.PAID,
            )
        )
        if not paid.scalar_one_or_none():
            raise HTTPException(
                status_code=402,
                detail="Payment required. Use /payment-intent to start checkout.",
            )

    enrollment = await _create_enrollment(course, current_user.id, db)
    count = await _get_enrollment_count(course_id, db)
    course_data = _add_enrollment_count(course, count)
    return EnrollmentResponse(
        id=enrollment.id,
        course_id=enrollment.course_id,
        status=enrollment.status,
        progress_percent=enrollment.progress_percent,
        last_accessed_lesson_id=enrollment.last_accessed_lesson_id,
        enrolled_at=enrollment.enrolled_at,
        completed_at=enrollment.completed_at,
        course=CourseListResponse(**course_data),
    )


@router.post("/{course_id}/payment-intent", response_model=CoursePaymentIntentResponse, status_code=201)
async def create_course_payment_intent(course_id: uuid.UUID, db: DB, current_user: CurrentUser):
    """Create a Stripe PaymentIntent for purchasing a paid course."""
    result = await db.execute(select(Course).where(Course.id == course_id, Course.is_published == True))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.is_free:
        raise HTTPException(status_code=400, detail="This course is free — use /enroll directly.")

    # Don't create duplicate PI if already paid
    already_paid = await db.execute(
        select(CoursePayment).where(
            CoursePayment.user_id == current_user.id,
            CoursePayment.course_id == course_id,
            CoursePayment.status == CoursePaymentStatus.PAID,
        )
    )
    if already_paid.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You have already purchased this course.")

    from app.services import stripe_service
    pi_data = await stripe_service.create_payment_intent(
        amount=course.price,
        currency="usd",
        metadata={
            "course_id": str(course_id),
            "user_id": str(current_user.id),
            "type": "course_purchase",
        },
    )

    payment = CoursePayment(
        user_id=current_user.id,
        course_id=course_id,
        payment_intent_id=pi_data["payment_intent_id"],
        amount=course.price,
        status=CoursePaymentStatus.PENDING,
    )
    db.add(payment)
    await db.flush()

    return CoursePaymentIntentResponse(
        client_secret=pi_data["client_secret"],
        payment_intent_id=pi_data["payment_intent_id"],
        amount=course.price,
        course_id=course_id,
    )


@router.post("/{course_id}/confirm-payment", response_model=EnrollmentResponse, status_code=201)
async def confirm_course_payment(
    course_id: uuid.UUID,
    payload: ConfirmCoursePaymentRequest,
    db: DB,
    current_user: CurrentUser,
):
    """Called after Stripe.js confirms card payment. Verifies with Stripe, creates enrollment."""
    import stripe as stripe_lib
    from app.core.config import settings

    # Verify with Stripe that the PaymentIntent is actually succeeded
    try:
        stripe_lib.api_key = settings.STRIPE_SECRET_KEY
        pi = stripe_lib.PaymentIntent.retrieve(payload.payment_intent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not verify payment with Stripe.")

    if pi.get("status") != "succeeded":
        raise HTTPException(status_code=402, detail="Payment has not been confirmed.")

    # Make sure the PI belongs to this user + course
    cp_result = await db.execute(
        select(CoursePayment).where(
            CoursePayment.payment_intent_id == payload.payment_intent_id,
            CoursePayment.user_id == current_user.id,
            CoursePayment.course_id == course_id,
        )
    )
    course_payment = cp_result.scalar_one_or_none()
    if not course_payment:
        raise HTTPException(status_code=404, detail="Payment record not found.")

    # Mark payment as paid (idempotent)
    course_payment.status = CoursePaymentStatus.PAID
    await db.flush()

    # Check for existing enrollment (webhook may have already created one)
    existing = await db.execute(
        select(Enrollment).where(
            Enrollment.user_id == current_user.id,
            Enrollment.course_id == course_id,
        )
    )
    enrollment = existing.scalar_one_or_none()

    course_result = await db.execute(select(Course).where(Course.id == course_id))
    course = course_result.scalar_one_or_none()

    if not enrollment:
        enrollment = await _create_enrollment(course, current_user.id, db)

    count = await _get_enrollment_count(course_id, db)
    course_data = _add_enrollment_count(course, count)
    return EnrollmentResponse(
        id=enrollment.id,
        course_id=enrollment.course_id,
        status=enrollment.status,
        progress_percent=enrollment.progress_percent,
        last_accessed_lesson_id=enrollment.last_accessed_lesson_id,
        enrolled_at=enrollment.enrolled_at,
        completed_at=enrollment.completed_at,
        course=CourseListResponse(**course_data),
    )


@router.get("/{course_id}/lessons/{lesson_id}", response_model=LessonDetailResponse)
async def get_lesson(course_id: uuid.UUID, lesson_id: uuid.UUID, db: DB, current_user: CurrentUser):
    # First check if course is published (for free preview lessons)
    course_result = await db.execute(select(Course).where(Course.id == course_id))
    course = course_result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    lesson_result = await db.execute(
        select(Lesson)
        .join(Section, Lesson.section_id == Section.id)
        .options(selectinload(Lesson.content_blocks), selectinload(Lesson.assessments).selectinload(Assessment.questions))
        .where(Lesson.id == lesson_id, Section.course_id == course_id)
    )
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    # Allow free preview lessons without enrollment; check course is published for them
    if not lesson.is_preview and not course.is_published:
        raise HTTPException(status_code=403, detail="Course is not published")
    
    # Check enrollment for paid/non-preview lessons
    if not lesson.is_preview:
        enrollment_result = await db.execute(
            select(Enrollment).where(
                Enrollment.user_id == current_user.id,
                Enrollment.course_id == course_id,
                Enrollment.status == EnrollmentStatus.ACTIVE,
            )
        )
        if not enrollment_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Enroll in this course to access this lesson")

    # Update last accessed
    enrollment_result = await db.execute(
        select(Enrollment).where(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
    )
    enrollment = enrollment_result.scalar_one_or_none()
    if enrollment:
        enrollment.last_accessed_lesson_id = lesson_id

    from app.schemas.courses import ContentBlockResponse, AssessmentResponse, QuizQuestionResponse
    return LessonDetailResponse(
        id=lesson.id, section_id=lesson.section_id, title=lesson.title,
        lesson_type=lesson.lesson_type, order_index=lesson.order_index,
        duration_seconds=lesson.duration_seconds, is_preview=lesson.is_preview,
        video_url=lesson.video_url, content=lesson.content,
        content_blocks=[ContentBlockResponse.model_validate(b) for b in lesson.content_blocks],
        assessments=[
            AssessmentResponse(
                **{k: getattr(a, k) for k in ['id','lesson_id','assessment_type','title','description','instructions','is_mandatory','passing_score','time_limit_minutes','order_index']},
                questions=[QuizQuestionResponse.model_validate(q) for q in a.questions]
            ) for a in lesson.assessments
        ],
    )


@router.post("/{course_id}/lessons/{lesson_id}/progress", response_model=LessonProgressResponse)
async def update_progress(
    course_id: uuid.UUID,
    lesson_id: uuid.UUID,
    payload: ProgressUpdate,
    db: DB,
    current_user: CurrentUser,
):
    enrollment_result = await db.execute(
        select(Enrollment).where(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
    )
    enrollment = enrollment_result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled")

    # Load lesson to determine its type and duration
    lesson_result = await db.execute(
        select(Lesson)
        .options(selectinload(Lesson.assessments))
        .where(Lesson.id == lesson_id)
    )
    lesson = lesson_result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")

    progress_result = await db.execute(
        select(LessonProgress).where(
            LessonProgress.enrollment_id == enrollment.id,
            LessonProgress.lesson_id == lesson_id,
        )
    )
    progress = progress_result.scalar_one_or_none()
    if not progress:
        progress = LessonProgress(enrollment_id=enrollment.id, lesson_id=lesson_id)
        db.add(progress)

    progress.watch_position_seconds = payload.watch_position_seconds

    # ── Completion rules ───────────────────────────────────────────────────────
    if not progress.is_completed:
        can_complete = False

        if lesson.lesson_type == "video":
            # Need duration on lesson; fall back to requiring 70% of watch_position
            # compared to duration_seconds if set, otherwise accept client flag
            if lesson.duration_seconds and lesson.duration_seconds > 0:
                watched_pct = (payload.watch_position_seconds / lesson.duration_seconds) * 100
                can_complete = watched_pct >= 70.0
            else:
                # No duration set — trust client-sent is_completed (video onEnded)
                can_complete = payload.is_completed

        elif lesson.lesson_type in ("text", "document", "code"):
            # Auto-complete on visit — client sends is_completed=true once scrolled/viewed
            can_complete = payload.is_completed

        elif lesson.lesson_type in ("mixed", "quiz"):
            # Require all mandatory assessments to be passed
            mandatory = [a for a in lesson.assessments if a.is_mandatory]
            if not mandatory:
                can_complete = payload.is_completed
            else:
                all_passed = True
                for assessment in mandatory:
                    passed_attempt = await db.scalar(
                        select(func.count(QuizAttempt.id)).where(
                            QuizAttempt.enrollment_id == enrollment.id,
                            QuizAttempt.assessment_id == assessment.id,
                            QuizAttempt.passed == True,
                        )
                    )
                    if not passed_attempt:
                        all_passed = False
                        break
                can_complete = all_passed
        else:
            can_complete = payload.is_completed

        if can_complete:
            progress.is_completed = True
            progress.completed_at = datetime.now(timezone.utc)

    await db.flush()

    # Recalculate overall progress
    enrollment.progress_percent = await _recalculate_progress(enrollment, db)

    # Auto-complete enrollment and issue certificate when all lessons done
    if enrollment.progress_percent >= 100.0 and enrollment.status == EnrollmentStatus.ACTIVE:
        enrollment.status = EnrollmentStatus.COMPLETED
        enrollment.completed_at = datetime.now(timezone.utc)
        cert_result = await db.execute(select(Certificate).where(Certificate.enrollment_id == enrollment.id))
        if not cert_result.scalar_one_or_none():
            cert = Certificate(
                enrollment_id=enrollment.id,
                user_id=current_user.id,
                course_id=course_id,
                certificate_number=_cert_number(current_user.id, course_id),
            )
            db.add(cert)

    await db.flush()

    return LessonProgressResponse(
        lesson_id=progress.lesson_id,
        is_completed=progress.is_completed,
        watch_position_seconds=progress.watch_position_seconds,
        completed_at=progress.completed_at,
        progress_percent=enrollment.progress_percent,
    )


@router.get("/{course_id}/progress", response_model=List[LessonProgressResponse])
async def get_course_progress(course_id: uuid.UUID, db: DB, current_user: CurrentUser):
    enrollment_result = await db.execute(
        select(Enrollment).where(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
    )
    enrollment = enrollment_result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=403, detail="Not enrolled")

    result = await db.execute(
        select(LessonProgress).where(LessonProgress.enrollment_id == enrollment.id)
    )
    return result.scalars().all()


@router.patch("/{course_id}", response_model=CourseListResponse)
async def update_course(course_id: uuid.UUID, payload: CourseUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(course, k, v)
    await db.flush()
    count = await _get_enrollment_count(course_id, db)
    data = _add_enrollment_count(course, count)
    return CourseListResponse(**data)


@router.delete("/{course_id}", status_code=204)
async def delete_course(course_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    await db.delete(course)


# ════════════════════════════════════════════════════════════════════════════════
# ══ WILDCARD ROUTE (must be last) ═══════════════════════════════════════════════
# ════════════════════════════════════════════════════════════════════════════════

@router.get("/{course_id}", response_model=CourseDetailResponse)
async def get_course(course_id: uuid.UUID, db: DB):
    course_result = await db.execute(
        select(Course).where(Course.id == course_id, Course.is_published == True)
    )
    course = course_result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Load top-level sections with their lessons
    sections_result = await db.execute(
        select(Section)
        .options(selectinload(Section.lessons))
        .where(Section.course_id == course_id, Section.parent_id == None)
        .order_by(Section.order_index)
    )
    top_sections = sections_result.scalars().all()

    # Load all sub-sections for this course with their lessons in one query
    all_subs_result = await db.execute(
        select(Section)
        .options(selectinload(Section.lessons))
        .where(Section.course_id == course_id, Section.parent_id != None)
        .order_by(Section.order_index)
    )
    all_sub_sections = all_subs_result.scalars().all()

    # Build parent_id → [children] map entirely in Python (no lazy loads)
    subs_by_parent: dict = {}
    for sub in all_sub_sections:
        subs_by_parent.setdefault(sub.parent_id, []).append(sub)

    from app.schemas.courses import SectionResponse, LessonResponse

    def build_section_public(s):
        children = subs_by_parent.get(s.id, [])
        return SectionResponse(
            id=s.id, course_id=s.course_id, parent_id=s.parent_id,
            title=s.title, description=s.description, order_index=s.order_index,
            lessons=[LessonResponse.model_validate(l) for l in s.lessons],
            sub_sections=[build_section_public(child) for child in children],
        )

    return CourseDetailResponse(
        id=course.id, title=course.title, slug=course.slug,
        description=course.description, short_description=course.short_description,
        thumbnail_url=course.thumbnail_url, level=course.level,
        price=course.price, is_free=course.is_free, is_published=course.is_published,
        estimated_hours=course.estimated_hours, tags=course.tags,
        instructor_name=course.instructor_name,
        enrollment_count=0,
        sections=[build_section_public(s) for s in top_sections],
    )
