import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.api.deps import AdminUser, CourseAdminUser, CurrentUser, DB, ensure_course_access, get_user_assigned_course_ids
from app.models.courses import (
    Assessment, Badge, Certificate, ContentBlock, Course, CourseInstructor, CoursePayment, CoursePaymentStatus,
    CoursePrerequisite, Coupon, CouponRedemption, Enrollment, EnrollmentStatus,
    Lesson, LessonComment, LessonProgress, QuizQuestion, Section,
)
from app.models.quiz_attempt import QuizAttempt
from app.models.ratings import CourseRating
from app.models.user import User, UserRole
from app.schemas.courses import (
    AssessmentCreate, AssessmentResponse, AssessmentUpdate,
    BadgeResponse,
    CertificateResponse, CertificatePublicResponse, ContentBlockCreate, ContentBlockResponse, ContentBlockUpdate,
    ConfirmCoursePaymentRequest, CourseAccessRequest, CourseAdminDetailResponse, CourseCreate, CourseDetailResponse, CourseInstructorResponse, CourseListResponse,
    CoursePaymentIntentResponse, CourseUpdate,
    CouponCreate, CouponResponse, CouponValidateResponse,
    EnrollmentResponse, EnrollmentAdminResponse, LessonCommentCreate, LessonCommentResponse,
    LessonCreate, LessonDetailResponse, LessonProgressResponse,
    LessonUpdate, ProgressUpdate, QuizQuestionCreate, QuizQuestionResponse, QuizQuestionUpdate,
    QuizSubmit, QuizAttemptResponse,
    ReorderItem, ReorderRequest,
    SectionCreate, SectionResponse, SectionUpdate,
)
from app.schemas.ratings import CourseRatingCreate, CourseRatingResponse, RatingSummary
from decimal import Decimal

router = APIRouter(prefix="/courses", tags=["courses"])


def _cert_number(user_id: uuid.UUID, course_id: uuid.UUID) -> str:
    import hashlib
    raw = f"{user_id}-{course_id}-{datetime.now(timezone.utc).isoformat()}"
    return "CERT-" + hashlib.sha1(raw.encode()).hexdigest()[:12].upper()


def _hash_access_code(code: str) -> str:
    import hashlib
    return hashlib.sha256(code.strip().lower().encode()).hexdigest()


def _verify_access_code(plain: str, hashed: str) -> bool:
    return _hash_access_code(plain) == hashed


def _apply_coupon(price: Decimal, coupon: "Coupon") -> Decimal:
    """Return the final price after applying the coupon (minimum $0)."""
    if coupon.discount_type == "percent":
        discount = (price * coupon.discount_value / Decimal("100")).quantize(Decimal("0.01"))
    else:
        discount = coupon.discount_value
    return max(Decimal("0.00"), price - discount)


async def _get_valid_coupon(
    code: str, course_id: uuid.UUID, user_id: uuid.UUID, db
) -> Optional["Coupon"]:
    """Return the Coupon if valid for this user/course, else None."""
    coupon = await db.scalar(
        select(Coupon).where(Coupon.code == code, Coupon.is_active == True)
    )
    if not coupon:
        return None
    # Scope check
    if coupon.course_id and coupon.course_id != course_id:
        return None
    # Expiry
    if coupon.expires_at and datetime.now(timezone.utc) > coupon.expires_at:
        return None
    # Global usage limit
    if coupon.max_uses is not None:
        total_uses = await db.scalar(
            select(func.count(CouponRedemption.id)).where(CouponRedemption.coupon_id == coupon.id)
        ) or 0
        if total_uses >= coupon.max_uses:
            return None
    # Per-user limit
    user_uses = await db.scalar(
        select(func.count(CouponRedemption.id)).where(
            CouponRedemption.coupon_id == coupon.id,
            CouponRedemption.user_id == user_id,
        )
    ) or 0
    if user_uses >= coupon.max_uses_per_user:
        return None
    return coupon


DEFAULT_LESSON_WEIGHT_SECONDS = 300  # 5 min — used for lessons with no tracked duration


async def _recalculate_progress(enrollment: Enrollment, db) -> float:
    """Recompute progress_percent as a duration-weighted ratio of completed lessons.

    Lessons without duration_seconds (most text/code/document lessons) count as
    DEFAULT_LESSON_WEIGHT_SECONDS so a 3-hour video and a 5-minute reading don't
    contribute equally toward 100%.
    """
    weight = func.coalesce(Lesson.duration_seconds, DEFAULT_LESSON_WEIGHT_SECONDS)

    total_weight = await db.scalar(
        select(func.sum(weight))
        .join(Section, Lesson.section_id == Section.id)
        .where(Section.course_id == enrollment.course_id)
    )
    if not total_weight:
        return 0.0

    completed_weight = await db.scalar(
        select(func.sum(weight))
        .join(Section, Lesson.section_id == Section.id)
        .join(LessonProgress, LessonProgress.lesson_id == Lesson.id)
        .where(
            Section.course_id == enrollment.course_id,
            LessonProgress.enrollment_id == enrollment.id,
            LessonProgress.is_completed == True,
        )
    )
    return round((float(completed_weight or 0) / float(total_weight)) * 100, 1)


async def _get_enrollment_count(course_id: uuid.UUID, db) -> int:
    """Get number of active enrollments for a single course."""
    count = await db.scalar(
        select(func.count(Enrollment.id)).where(
            Enrollment.course_id == course_id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
    )
    return count or 0


async def _get_enrollment_counts_bulk(course_ids: list, db) -> dict:
    """Get active-enrollment counts for many courses in a single query (avoids
    calling _get_enrollment_count in a per-course loop when listing courses)."""
    if not course_ids:
        return {}
    rows = await db.execute(
        select(Enrollment.course_id, func.count(Enrollment.id))
        .where(Enrollment.course_id.in_(course_ids), Enrollment.status == EnrollmentStatus.ACTIVE)
        .group_by(Enrollment.course_id)
    )
    return {course_id: count for course_id, count in rows.all()}


def _add_enrollment_count(course: Course, enrollment_count: int) -> dict:
    """Convert course ORM to dict with enrollment_count."""
    data = {k: getattr(course, k) for k in ['id','title','slug','short_description','thumbnail_url','level','price','is_free','is_published','is_private','estimated_hours','tags','instructor_name']}
    data['enrollment_count'] = enrollment_count
    return data


# ── course_id resolution helpers (for row-level instructor access checks) ─────

async def _course_id_from_section(section_id: uuid.UUID, db) -> Optional[uuid.UUID]:
    return await db.scalar(select(Section.course_id).where(Section.id == section_id))


async def _course_id_from_lesson(lesson_id: uuid.UUID, db) -> Optional[uuid.UUID]:
    return await db.scalar(
        select(Section.course_id).join(Lesson, Lesson.section_id == Section.id).where(Lesson.id == lesson_id)
    )


async def _course_id_from_assessment(assessment_id: uuid.UUID, db) -> Optional[uuid.UUID]:
    return await db.scalar(
        select(Section.course_id)
        .join(Lesson, Lesson.section_id == Section.id)
        .join(Assessment, Assessment.lesson_id == Lesson.id)
        .where(Assessment.id == assessment_id)
    )


async def _course_id_from_content_block(block_id: uuid.UUID, db) -> Optional[uuid.UUID]:
    return await db.scalar(
        select(Section.course_id)
        .join(Lesson, Lesson.section_id == Section.id)
        .join(ContentBlock, ContentBlock.lesson_id == Lesson.id)
        .where(ContentBlock.id == block_id)
    )


async def _course_id_from_quiz_question(question_id: uuid.UUID, db) -> Optional[uuid.UUID]:
    return await db.scalar(
        select(Section.course_id)
        .join(Lesson, Lesson.section_id == Section.id)
        .join(Assessment, Assessment.lesson_id == Lesson.id)
        .join(QuizQuestion, QuizQuestion.assessment_id == Assessment.id)
        .where(QuizQuestion.id == question_id)
    )


async def _check_drip_lock(lesson: Lesson, enrollment: Enrollment) -> None:
    """Raise 403 if this lesson is on a drip schedule and hasn't unlocked yet."""
    if lesson.is_preview or lesson.available_after_days is None:
        return
    unlocks_at = enrollment.enrolled_at + timedelta(days=lesson.available_after_days)
    if datetime.now(timezone.utc) < unlocks_at:
        raise HTTPException(
            status_code=403,
            detail=f"This lesson unlocks on {unlocks_at.date().isoformat()}",
        )


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

    counts = await _get_enrollment_counts_bulk([c.id for c in courses], db)
    return [CourseListResponse(**_add_enrollment_count(c, counts.get(c.id, 0))) for c in courses]


@router.post("/", response_model=CourseListResponse, status_code=201)
async def create_course(payload: CourseCreate, db: DB, _: CourseAdminUser):
    data = payload.model_dump()
    prerequisite_ids = data.pop("prerequisite_course_ids", [])
    access_code = data.pop("access_code", None)
    if access_code:
        data["access_code_hash"] = _hash_access_code(access_code)
    obj = Course(**data)
    db.add(obj)
    await db.flush()
    for prereq_id in prerequisite_ids:
        db.add(CoursePrerequisite(course_id=obj.id, prerequisite_course_id=prereq_id))
    await db.flush()
    return CourseListResponse(**_add_enrollment_count(obj, 0))


# ── Admin routes ──────────────────────────────────────────────────────────────

@router.get("/admin/all", response_model=List[CourseListResponse])
async def list_courses_admin(db: DB, current_user: CourseAdminUser, skip: int = 0, limit: int = 200):
    query = select(Course)
    assigned = await get_user_assigned_course_ids(current_user, db)
    if assigned is not None:  # instructor scoped to specific courses, not full manage_courses access
        query = query.where(Course.id.in_(assigned))
    result = await db.execute(query.offset(skip).limit(limit))
    courses = result.scalars().all()

    counts = await _get_enrollment_counts_bulk([c.id for c in courses], db)
    return [CourseListResponse(**_add_enrollment_count(c, counts.get(c.id, 0))) for c in courses]


@router.get("/admin/{course_id}", response_model=CourseAdminDetailResponse)
async def get_course_admin(course_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    await ensure_course_access(course_id, current_user, db)
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
    from app.schemas.courses import SectionAdminResponse, LessonDetailResponse, ContentBlockResponse, AssessmentResponse, QuizQuestionResponse

    def build_lesson(l):
        return LessonDetailResponse(
            id=l.id, section_id=l.section_id, title=l.title,
            lesson_type=l.lesson_type, order_index=l.order_index,
            duration_seconds=l.duration_seconds, is_preview=l.is_preview,
            available_after_days=l.available_after_days,
            video_url=l.video_url, content=l.content,
            content_blocks=[ContentBlockResponse.model_validate(b) for b in l.content_blocks],
            assessments=[
                AssessmentResponse(
                    **{k: getattr(a, k) for k in ['id','lesson_id','assessment_type','title','description','instructions','is_mandatory','passing_score','time_limit_minutes','time_per_question_seconds','order_index']},
                    questions=[QuizQuestionResponse.model_validate(q) for q in a.questions]
                ) for a in l.assessments
            ],
        )

    def build_section(s):
        # Get pre-loaded subsections
        subs = all_subs.get(s.id, [])
        return SectionAdminResponse(
            id=s.id, course_id=s.course_id, parent_id=s.parent_id,
            title=s.title, description=s.description, order_index=s.order_index,
            lessons=[build_lesson(l) for l in s.lessons],
            sub_sections=[build_section(sub) for sub in subs],
        )

    enrollment_count = await _get_enrollment_count(course_id, db)
    prereq_ids = list((await db.scalars(
        select(CoursePrerequisite.prerequisite_course_id).where(CoursePrerequisite.course_id == course_id)
    )).all())

    return CourseAdminDetailResponse(
        id=course.id, title=course.title, slug=course.slug,
        description=course.description, short_description=course.short_description,
        thumbnail_url=course.thumbnail_url, level=course.level,
        price=course.price, is_free=course.is_free, is_published=course.is_published,
        is_private=course.is_private,
        estimated_hours=course.estimated_hours, tags=course.tags,
        instructor_name=course.instructor_name,
        enrollment_count=enrollment_count,
        prerequisite_course_ids=prereq_ids,
        sections=[build_section(s) for s in top_sections],
    )


@router.get("/admin/{course_id}/enrollments", response_model=List[EnrollmentAdminResponse])
async def list_course_enrollments(course_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    """List all enrollments for a course."""
    await ensure_course_access(course_id, current_user, db)
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
async def unenroll_student(enrollment_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    """Remove a student from a course."""
    result = await db.execute(select(Enrollment).where(Enrollment.id == enrollment_id))
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    await ensure_course_access(enrollment.course_id, current_user, db)
    await db.delete(enrollment)


# ── Course Instructors (admin-only: assigning instructors is an admin action) ──

@router.get("/{course_id}/instructors", response_model=List[CourseInstructorResponse])
async def list_course_instructors(course_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(
        select(CourseInstructor).options(selectinload(CourseInstructor.user)).where(CourseInstructor.course_id == course_id)
    )
    return [
        CourseInstructorResponse(
            id=ci.id, user_id=ci.user_id, course_id=ci.course_id,
            full_name=ci.user.full_name if ci.user else "", email=ci.user.email if ci.user else "",
        )
        for ci in result.scalars().all()
    ]


@router.post("/{course_id}/instructors", response_model=CourseInstructorResponse, status_code=201)
async def assign_course_instructor(course_id: uuid.UUID, user_id: uuid.UUID, db: DB, _: AdminUser):
    course = await db.scalar(select(Course).where(Course.id == course_id))
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    user = await db.scalar(select(User).where(User.id == user_id))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    existing = await db.scalar(
        select(CourseInstructor).where(CourseInstructor.course_id == course_id, CourseInstructor.user_id == user_id)
    )
    if existing:
        raise HTTPException(status_code=409, detail="Already assigned to this course")
    ci = CourseInstructor(course_id=course_id, user_id=user_id)
    db.add(ci)
    await db.flush()
    return CourseInstructorResponse(id=ci.id, user_id=ci.user_id, course_id=ci.course_id, full_name=user.full_name, email=user.email)


@router.delete("/{course_id}/instructors/{user_id}", status_code=204)
async def unassign_course_instructor(course_id: uuid.UUID, user_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(
        select(CourseInstructor).where(CourseInstructor.course_id == course_id, CourseInstructor.user_id == user_id)
    )
    ci = result.scalar_one_or_none()
    if not ci:
        raise HTTPException(status_code=404, detail="Instructor assignment not found")
    await db.delete(ci)


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


@router.get("/my/badges", response_model=List[BadgeResponse])
async def my_badges(db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Badge)
        .options(selectinload(Badge.course))
        .where(Badge.user_id == current_user.id)
        .order_by(Badge.issued_at.desc())
    )
    badges = result.scalars().all()
    return [
        BadgeResponse(
            id=b.id,
            enrollment_id=b.enrollment_id,
            course_id=b.course_id,
            badge_type=b.badge_type,
            title=b.title,
            issued_at=b.issued_at,
            course=CourseListResponse(**_add_enrollment_count(b.course, 0)),
        )
        for b in badges
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
async def list_content_blocks(lesson_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    course_id = await _course_id_from_lesson(lesson_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    result = await db.execute(
        select(ContentBlock).where(ContentBlock.lesson_id == lesson_id).order_by(ContentBlock.order_index)
    )
    return result.scalars().all()


@router.post("/lessons/{lesson_id}/blocks", response_model=ContentBlockResponse, status_code=201)
async def create_content_block(lesson_id: uuid.UUID, payload: ContentBlockCreate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Lesson not found")
    course_id = await _course_id_from_lesson(lesson_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    obj = ContentBlock(lesson_id=lesson_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/blocks/{block_id}", response_model=ContentBlockResponse)
async def update_content_block(block_id: uuid.UUID, payload: ContentBlockUpdate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(ContentBlock).where(ContentBlock.id == block_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Content block not found")
    course_id = await _course_id_from_content_block(block_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/blocks/{block_id}", status_code=204)
async def delete_content_block(block_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(ContentBlock).where(ContentBlock.id == block_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Content block not found")
    course_id = await _course_id_from_content_block(block_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    await db.delete(obj)


# ── Assessment routes ─────────────────────────────────────────────────────────

@router.get("/lessons/{lesson_id}/assessments", response_model=List[AssessmentResponse])
async def list_assessments(lesson_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    course_id = await _course_id_from_lesson(lesson_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    result = await db.execute(
        select(Assessment)
        .options(selectinload(Assessment.questions))
        .where(Assessment.lesson_id == lesson_id)
        .order_by(Assessment.order_index)
    )
    return result.scalars().all()


@router.post("/lessons/{lesson_id}/assessments", response_model=AssessmentResponse, status_code=201)
async def create_assessment(lesson_id: uuid.UUID, payload: AssessmentCreate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Lesson not found")
    course_id = await _course_id_from_lesson(lesson_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    obj = Assessment(lesson_id=lesson_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj, ["questions"])
    return obj


@router.patch("/assessments/{assessment_id}", response_model=AssessmentResponse)
async def update_assessment(assessment_id: uuid.UUID, payload: AssessmentUpdate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(
        select(Assessment).options(selectinload(Assessment.questions)).where(Assessment.id == assessment_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Assessment not found")
    course_id = await _course_id_from_assessment(assessment_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/assessments/{assessment_id}", status_code=204)
async def delete_assessment(assessment_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Assessment not found")
    course_id = await _course_id_from_assessment(assessment_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
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
    await _check_drip_lock(lesson, enrollment)

    # Score the quiz — supports both single-select and multi-select questions
    questions = sorted(assessment.questions, key=lambda q: q.order_index)
    score = 0
    results = []

    for idx, q in enumerate(questions):
        raw_answer = payload.answers[idx] if idx < len(payload.answers) else None

        if q.is_multi_select:
            correct_set = set(q.correct_answer_indices or [q.correct_answer_index])
            user_set = set(raw_answer) if isinstance(raw_answer, list) else ({raw_answer} if raw_answer is not None else set())
            is_correct = user_set == correct_set
            your_answer_text = ", ".join(q.options[i] for i in sorted(user_set) if i < len(q.options)) or None
            correct_answer_text = ", ".join(q.options[i] for i in sorted(correct_set) if i < len(q.options))
        else:
            user_idx = raw_answer if isinstance(raw_answer, int) else (raw_answer[0] if isinstance(raw_answer, list) and raw_answer else None)
            is_correct = user_idx == q.correct_answer_index
            your_answer_text = q.options[user_idx] if user_idx is not None and user_idx < len(q.options) else None
            correct_answer_text = q.options[q.correct_answer_index] if q.correct_answer_index < len(q.options) else ""

        if is_correct:
            score += 1
        results.append({
            "question_text": q.question_text,
            "your_answer": your_answer_text,
            "correct_answer": correct_answer_text,
            "correct": is_correct,
            "explanation": q.explanation or "",
        })

    score_percent = round((score / len(questions) * 100)) if questions else 0
    passed = score_percent >= (assessment.passing_score or 70)

    # Serialise answers as a plain list for storage
    serialised_answers = [a if isinstance(a, list) else [a] if a is not None else [] for a in payload.answers]

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
        answers=serialised_answers,
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
        answers=serialised_answers,
        submitted_at=attempt.submitted_at,
        results=results,
    )


# ── Quiz Question routes ──────────────────────────────────────────────────────

@router.post("/assessments/{assessment_id}/questions", response_model=QuizQuestionResponse, status_code=201)
async def create_quiz_question(assessment_id: uuid.UUID, payload: QuizQuestionCreate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(Assessment).where(Assessment.id == assessment_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Assessment not found")
    course_id = await _course_id_from_assessment(assessment_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    obj = QuizQuestion(assessment_id=assessment_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/questions/{question_id}", response_model=QuizQuestionResponse)
async def update_quiz_question(question_id: uuid.UUID, payload: QuizQuestionUpdate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(QuizQuestion).where(QuizQuestion.id == question_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Question not found")
    course_id = await _course_id_from_quiz_question(question_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/questions/{question_id}", status_code=204)
async def delete_quiz_question(question_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(QuizQuestion).where(QuizQuestion.id == question_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Question not found")
    course_id = await _course_id_from_quiz_question(question_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    await db.delete(obj)


# ── Section routes ────────────────────────────────────────────────────────────

@router.post("/sections/{section_id}/lessons", response_model=LessonDetailResponse, status_code=201)
async def create_lesson(section_id: uuid.UUID, payload: LessonCreate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(Section).where(Section.id == section_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Section not found")
    course_id = await _course_id_from_section(section_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    obj = Lesson(section_id=section_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    return LessonDetailResponse(
        id=obj.id, section_id=obj.section_id, title=obj.title,
        lesson_type=obj.lesson_type, order_index=obj.order_index,
        duration_seconds=obj.duration_seconds, is_preview=obj.is_preview,
        available_after_days=obj.available_after_days,
        video_url=obj.video_url, content=obj.content,
        content_blocks=[], assessments=[],
    )


@router.patch("/sections/{section_id}", response_model=SectionResponse)
async def update_section(section_id: uuid.UUID, payload: SectionUpdate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(
        select(Section)
        .options(selectinload(Section.lessons), selectinload(Section.sub_sections))
        .where(Section.id == section_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Section not found")
    await ensure_course_access(obj.course_id, current_user, db)
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
async def delete_section(section_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(Section).where(Section.id == section_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Section not found")
    await ensure_course_access(obj.course_id, current_user, db)
    await db.delete(obj)


@router.patch("/sections/{section_id}/lessons/reorder", status_code=204)
async def reorder_lessons(section_id: uuid.UUID, payload: ReorderRequest, db: DB, current_user: CourseAdminUser):
    """Reorder lessons within a section."""
    course_id = await _course_id_from_section(section_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
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
async def update_lesson(lesson_id: uuid.UUID, payload: LessonUpdate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(
        select(Lesson)
        .options(selectinload(Lesson.content_blocks), selectinload(Lesson.assessments).selectinload(Assessment.questions))
        .where(Lesson.id == lesson_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Lesson not found")
    course_id = await _course_id_from_section(obj.section_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    from app.schemas.courses import ContentBlockResponse, AssessmentResponse, QuizQuestionResponse
    return LessonDetailResponse(
        id=obj.id, section_id=obj.section_id, title=obj.title,
        lesson_type=obj.lesson_type, order_index=obj.order_index,
        duration_seconds=obj.duration_seconds, is_preview=obj.is_preview,
        available_after_days=obj.available_after_days,
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
async def delete_lesson(lesson_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Lesson not found")
    course_id = await _course_id_from_section(obj.section_id, db)
    if course_id:
        await ensure_course_access(course_id, current_user, db)
    await db.delete(obj)


# ════════════════════════════════════════════════════════════════════════════════
# ══ COURSE-SPECIFIC ROUTES (before wildcard /{course_id}) ═════════════════════
# ════════════════════════════════════════════════════════════════════════════════

@router.post("/{course_id}/sections", response_model=SectionResponse, status_code=201)
async def create_section(course_id: uuid.UUID, payload: SectionCreate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(Course).where(Course.id == course_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")
    await ensure_course_access(course_id, current_user, db)
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
async def reorder_sections(course_id: uuid.UUID, payload: ReorderRequest, db: DB, current_user: CourseAdminUser):
    """Reorder sections within a course."""
    await ensure_course_access(course_id, current_user, db)
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


@router.post("/{course_id}/access", status_code=200)
async def verify_course_access(course_id: uuid.UUID, payload: CourseAccessRequest, db: DB, current_user: CurrentUser):
    """Verify an access code for a private course. Returns 200 on success."""
    result = await db.execute(select(Course).where(Course.id == course_id, Course.is_published == True))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not course.is_private:
        return {"valid": True}
    if not course.access_code_hash or not _verify_access_code(payload.access_code, course.access_code_hash):
        raise HTTPException(status_code=403, detail="Invalid access code")
    return {"valid": True}


@router.post("/{course_id}/enroll", response_model=EnrollmentResponse, status_code=201)
async def enroll(course_id: uuid.UUID, db: DB, current_user: CurrentUser, access_code: Optional[str] = None):
    """Enroll in a course.
    - Free courses: allowed immediately.
    - Private courses: require a valid access_code query param.
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

    # Private course gate (admins exempt)
    if course.is_private and current_user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN):
        if not access_code or not course.access_code_hash or not _verify_access_code(access_code, course.access_code_hash):
            raise HTTPException(status_code=403, detail="A valid access code is required to enroll in this course")

    # Prerequisite gate: must hold a certificate for every prerequisite course (admins exempt)
    if current_user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN):
        prereqs = await db.execute(
            select(CoursePrerequisite)
            .options(selectinload(CoursePrerequisite.prerequisite_course))
            .where(CoursePrerequisite.course_id == course_id)
        )
        missing = []
        for p in prereqs.scalars().all():
            has_cert = await db.scalar(
                select(func.count(Certificate.id)).where(
                    Certificate.user_id == current_user.id,
                    Certificate.course_id == p.prerequisite_course_id,
                )
            )
            if not has_cert:
                missing.append(p.prerequisite_course.title if p.prerequisite_course else str(p.prerequisite_course_id))
        if missing:
            raise HTTPException(
                status_code=403,
                detail=f"Complete these prerequisite course(s) first: {', '.join(missing)}",
            )

    # Payment gate: paid courses require a confirmed payment (admins are exempt)
    if not course.is_free and current_user.role not in (UserRole.ADMIN, UserRole.SUPERADMIN):
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


@router.post("/{course_id}/coupons/validate", response_model=CouponValidateResponse)
async def validate_coupon(course_id: uuid.UUID, code: str, db: DB, current_user: CurrentUser):
    """Validate a coupon code for a course and return the discounted price."""
    result = await db.execute(select(Course).where(Course.id == course_id, Course.is_published == True))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    coupon = await _get_valid_coupon(code.strip().upper(), course_id, current_user.id, db)
    if not coupon:
        return CouponValidateResponse(valid=False, discount_type="percent", discount_value=Decimal("0"), final_price=course.price, message="Invalid or expired coupon code")

    final_price = _apply_coupon(course.price, coupon)
    return CouponValidateResponse(
        valid=True,
        discount_type=coupon.discount_type,
        discount_value=coupon.discount_value,
        final_price=final_price,
        message=f"{coupon.discount_type == 'percent' and f'{coupon.discount_value}% off' or f'${coupon.discount_value} off'}",
    )


@router.post("/{course_id}/payment-intent", response_model=CoursePaymentIntentResponse, status_code=201)
async def create_course_payment_intent(course_id: uuid.UUID, db: DB, current_user: CurrentUser, coupon_code: Optional[str] = None):
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

    # Apply coupon if provided
    charge_amount = course.price
    discount_applied = Decimal("0.00")
    applied_coupon = None
    if coupon_code:
        applied_coupon = await _get_valid_coupon(coupon_code.strip().upper(), course_id, current_user.id, db)
        if applied_coupon:
            charge_amount = _apply_coupon(course.price, applied_coupon)
            discount_applied = course.price - charge_amount

    from app.services import stripe_service
    pi_data = await stripe_service.create_payment_intent(
        amount=charge_amount,
        currency="usd",
        metadata={
            "course_id": str(course_id),
            "user_id": str(current_user.id),
            "type": "course_purchase",
            "coupon_code": coupon_code or "",
        },
    )

    payment = CoursePayment(
        user_id=current_user.id,
        course_id=course_id,
        payment_intent_id=pi_data["payment_intent_id"],
        amount=charge_amount,
        status=CoursePaymentStatus.PENDING,
    )
    db.add(payment)
    await db.flush()

    return CoursePaymentIntentResponse(
        client_secret=pi_data["client_secret"],
        payment_intent_id=pi_data["payment_intent_id"],
        amount=charge_amount,
        course_id=course_id,
        coupon_code=coupon_code if applied_coupon else None,
        discount_applied=discount_applied,
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

    # Record coupon redemption if a coupon was used
    coupon_code = pi.get("metadata", {}).get("coupon_code", "")
    if coupon_code:
        coupon = await db.scalar(select(Coupon).where(Coupon.code == coupon_code))
        if coupon:
            already_redeemed = await db.scalar(
                select(CouponRedemption).where(
                    CouponRedemption.coupon_id == coupon.id,
                    CouponRedemption.user_id == current_user.id,
                    CouponRedemption.course_id == course_id,
                )
            )
            if not already_redeemed:
                original_price = (await db.scalar(select(Course.price).where(Course.id == course_id))) or course_payment.amount
                db.add(CouponRedemption(
                    coupon_id=coupon.id,
                    user_id=current_user.id,
                    course_id=course_id,
                    discount_applied=original_price - course_payment.amount,
                ))

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

    enrollment_result = await db.execute(
        select(Enrollment).where(Enrollment.user_id == current_user.id, Enrollment.course_id == course_id)
    )
    enrollment = enrollment_result.scalar_one_or_none()

    # Check enrollment for paid/non-preview lessons
    if not lesson.is_preview:
        if not enrollment or enrollment.status != EnrollmentStatus.ACTIVE:
            raise HTTPException(status_code=403, detail="Enroll in this course to access this lesson")
        await _check_drip_lock(lesson, enrollment)

    # Update last accessed
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
                id=a.id, lesson_id=a.lesson_id, assessment_type=a.assessment_type,
                title=a.title, description=a.description, instructions=a.instructions,
                is_mandatory=a.is_mandatory, passing_score=a.passing_score,
                time_limit_minutes=a.time_limit_minutes,
                time_per_question_seconds=a.time_per_question_seconds,
                order_index=a.order_index,
                questions=[QuizQuestionResponse.model_validate(q) for q in (a.questions or [])]
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
    await _check_drip_lock(lesson, enrollment)

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
            # Completion requires proof of watch-time. If duration_seconds isn't set on
            # the lesson, there's no basis to verify 70% watched, so deny rather than
            # trust the client's is_completed flag.
            if lesson.duration_seconds and lesson.duration_seconds > 0:
                watched_pct = (payload.watch_position_seconds / lesson.duration_seconds) * 100
                can_complete = watched_pct >= 70.0
            else:
                can_complete = False

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

    # Auto-complete enrollment, issue certificate + badge when all lessons done
    issued_cert_number: Optional[str] = None
    badge_issued = False
    if enrollment.progress_percent >= 100.0 and enrollment.status == EnrollmentStatus.ACTIVE:
        enrollment.status = EnrollmentStatus.COMPLETED
        enrollment.completed_at = datetime.now(timezone.utc)

        cert_result = await db.execute(select(Certificate).where(Certificate.enrollment_id == enrollment.id))
        existing_cert = cert_result.scalar_one_or_none()
        if not existing_cert:
            course_result = await db.execute(select(Course).where(Course.id == course_id))
            course_obj = course_result.scalar_one_or_none()
            cert_num = _cert_number(current_user.id, course_id)
            cert = Certificate(
                enrollment_id=enrollment.id,
                user_id=current_user.id,
                course_id=course_id,
                certificate_number=cert_num,
            )
            db.add(cert)
            issued_cert_number = cert_num

            course_title = course_obj.title if course_obj else "Course"

            async def _award_badge_if_new(badge_type: str, title: str, *, per_user: bool = False) -> bool:
                if per_user:
                    already = await db.scalar(
                        select(Badge).where(Badge.user_id == current_user.id, Badge.badge_type == badge_type)
                    )
                else:
                    already = await db.scalar(
                        select(Badge).where(Badge.enrollment_id == enrollment.id, Badge.badge_type == badge_type)
                    )
                if already:
                    return False
                db.add(Badge(
                    enrollment_id=enrollment.id, user_id=current_user.id, course_id=course_id,
                    badge_type=badge_type, title=title,
                ))
                return True

            badge_issued = await _award_badge_if_new("course_completion", f"Completed: {course_title}")

            # Perfect score: every mandatory quiz in the course passed at 100% on the first attempt
            mandatory_quiz_ids = (await db.execute(
                select(Assessment.id)
                .join(Lesson, Assessment.lesson_id == Lesson.id)
                .join(Section, Lesson.section_id == Section.id)
                .where(Section.course_id == course_id, Assessment.is_mandatory == True, Assessment.assessment_type == "quiz")
            )).scalars().all()
            if mandatory_quiz_ids:
                perfect_score = True
                for aid in mandatory_quiz_ids:
                    first_attempt = await db.scalar(
                        select(QuizAttempt).where(
                            QuizAttempt.enrollment_id == enrollment.id,
                            QuizAttempt.assessment_id == aid,
                            QuizAttempt.attempt_number == 1,
                        )
                    )
                    if not first_attempt or first_attempt.score_percent < 100.0:
                        perfect_score = False
                        break
                if perfect_score:
                    await _award_badge_if_new("perfect_quiz_score", f"Perfect score: {course_title}")

            # Speed learner: completed within 48 hours of enrolling
            if enrollment.completed_at - enrollment.enrolled_at < timedelta(hours=48):
                await _award_badge_if_new("speed_learner", f"Speed learner: {course_title}")

            # User-lifetime milestones (one-time, independent of which course triggered them)
            completed_count = await db.scalar(
                select(func.count(Enrollment.id)).where(
                    Enrollment.user_id == current_user.id, Enrollment.status == EnrollmentStatus.COMPLETED,
                )
            )
            milestone_titles = {1: "First course completed!", 3: "3 courses completed", 5: "5 courses completed"}
            if completed_count in milestone_titles:
                badge_type = "first_course_completed" if completed_count == 1 else f"milestone_{completed_count}_courses"
                await _award_badge_if_new(badge_type, milestone_titles[completed_count], per_user=True)

            from app.tasks.email_tasks import send_course_completion_task
            from app.core.config import settings as _s
            send_course_completion_task.delay(
                to=current_user.email,
                full_name=current_user.full_name or current_user.email,
                course_title=course_obj.title if course_obj else "your course",
                cert_number=cert_num,
                cert_url=f"{_s.FRONTEND_URL}/courses/certificate/{cert_num}",
            )
        else:
            issued_cert_number = existing_cert.certificate_number

    await db.flush()

    return LessonProgressResponse(
        lesson_id=progress.lesson_id,
        is_completed=progress.is_completed,
        watch_position_seconds=progress.watch_position_seconds,
        completed_at=progress.completed_at,
        progress_percent=enrollment.progress_percent,
        certificate_number=issued_cert_number,
        badge_issued=badge_issued,
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


# ── Lesson discussion (Q&A) ───────────────────────────────────────────────────

async def _can_access_discussion(course_id: uuid.UUID, current_user: User, db) -> bool:
    """Enrolled learners and this course's instructors/admins can read/post comments."""
    if current_user.role in (UserRole.ADMIN, UserRole.SUPERADMIN):
        return True
    is_instructor = await db.scalar(
        select(CourseInstructor).where(CourseInstructor.course_id == course_id, CourseInstructor.user_id == current_user.id)
    )
    if is_instructor:
        return True
    enrollment = await db.scalar(
        select(Enrollment).where(
            Enrollment.course_id == course_id, Enrollment.user_id == current_user.id,
            Enrollment.status == EnrollmentStatus.ACTIVE,
        )
    )
    return enrollment is not None


@router.get("/{course_id}/lessons/{lesson_id}/comments", response_model=List[LessonCommentResponse])
async def list_lesson_comments(course_id: uuid.UUID, lesson_id: uuid.UUID, db: DB, current_user: CurrentUser):
    if not await _can_access_discussion(course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Enroll in this course to view its discussion")
    result = await db.execute(
        select(LessonComment)
        .options(selectinload(LessonComment.replies))
        .where(LessonComment.lesson_id == lesson_id, LessonComment.parent_comment_id.is_(None))
        .order_by(LessonComment.created_at)
    )
    return result.scalars().all()


@router.post("/{course_id}/lessons/{lesson_id}/comments", response_model=LessonCommentResponse, status_code=201)
async def create_lesson_comment(
    course_id: uuid.UUID, lesson_id: uuid.UUID, payload: LessonCommentCreate, db: DB, current_user: CurrentUser,
):
    if not await _can_access_discussion(course_id, current_user, db):
        raise HTTPException(status_code=403, detail="Enroll in this course to post in its discussion")

    is_instructor_reply = current_user.role in (UserRole.ADMIN, UserRole.SUPERADMIN) or bool(
        await db.scalar(
            select(CourseInstructor).where(CourseInstructor.course_id == course_id, CourseInstructor.user_id == current_user.id)
        )
    )

    parent = None
    if payload.parent_comment_id:
        parent = await db.scalar(select(LessonComment).where(LessonComment.id == payload.parent_comment_id))
        if not parent or parent.lesson_id != lesson_id:
            raise HTTPException(status_code=404, detail="Parent comment not found")

    comment = LessonComment(
        lesson_id=lesson_id,
        user_id=current_user.id,
        parent_comment_id=payload.parent_comment_id,
        author_name=current_user.full_name or current_user.email,
        content=payload.content,
        is_instructor_reply=is_instructor_reply,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment, ["replies"])

    if parent and parent.user_id and parent.user_id != current_user.id:
        parent_author = await db.scalar(select(User).where(User.id == parent.user_id))
        if parent_author and parent_author.email:
            lesson = await db.scalar(select(Lesson).where(Lesson.id == lesson_id))
            from app.tasks.email_tasks import send_lesson_reply_notification_task
            send_lesson_reply_notification_task.delay(
                recipient_email=parent_author.email,
                recipient_name=parent_author.full_name or parent_author.email,
                lesson_title=lesson.title if lesson else "a lesson",
                reply_author_name=comment.author_name,
                reply_content=comment.content,
                course_id=str(course_id),
                lesson_id=str(lesson_id),
            )

    return LessonCommentResponse.model_validate(comment)


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_lesson_comment(comment_id: uuid.UUID, db: DB, current_user: CurrentUser):
    comment = await db.scalar(select(LessonComment).where(LessonComment.id == comment_id))
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    is_own = comment.user_id == current_user.id
    is_admin = current_user.role in (UserRole.ADMIN, UserRole.SUPERADMIN)
    if not is_own and not is_admin:
        course_id = await _course_id_from_lesson(comment.lesson_id, db)
        is_instructor = course_id and await db.scalar(
            select(CourseInstructor).where(CourseInstructor.course_id == course_id, CourseInstructor.user_id == current_user.id)
        )
        if not is_instructor:
            raise HTTPException(status_code=403, detail="You can only delete your own comments")
    await db.delete(comment)


@router.get("/coupons", response_model=List[CouponResponse])
async def list_coupons(db: DB, _: CourseAdminUser, course_id: Optional[uuid.UUID] = None):
    """List all coupons (admin). Optionally filter by course."""
    query = select(Coupon)
    if course_id:
        query = query.where(or_(Coupon.course_id == course_id, Coupon.course_id.is_(None)))
    result = await db.execute(query.order_by(Coupon.created_at.desc()))
    coupons = result.scalars().all()
    out = []
    for c in coupons:
        use_count = await db.scalar(select(func.count(CouponRedemption.id)).where(CouponRedemption.coupon_id == c.id)) or 0
        out.append(CouponResponse(
            id=c.id, code=c.code, discount_type=c.discount_type, discount_value=c.discount_value,
            course_id=c.course_id, max_uses=c.max_uses, max_uses_per_user=c.max_uses_per_user,
            expires_at=c.expires_at, is_active=c.is_active, created_at=c.created_at, use_count=use_count,
        ))
    return out


@router.post("/coupons", response_model=CouponResponse, status_code=201)
async def create_coupon(payload: CouponCreate, db: DB, _: CourseAdminUser):
    """Create a new coupon (admin)."""
    if payload.discount_type not in ("percent", "fixed"):
        raise HTTPException(status_code=400, detail="discount_type must be 'percent' or 'fixed'")
    if payload.discount_type == "percent" and not (0 < float(payload.discount_value) <= 100):
        raise HTTPException(status_code=400, detail="Percent discount must be between 1 and 100")
    existing = await db.scalar(select(Coupon).where(Coupon.code == payload.code.strip().upper()))
    if existing:
        raise HTTPException(status_code=409, detail="Coupon code already exists")
    coupon = Coupon(
        code=payload.code.strip().upper(),
        discount_type=payload.discount_type,
        discount_value=payload.discount_value,
        course_id=payload.course_id,
        max_uses=payload.max_uses,
        max_uses_per_user=payload.max_uses_per_user,
        expires_at=payload.expires_at,
    )
    db.add(coupon)
    await db.flush()
    return CouponResponse(
        id=coupon.id, code=coupon.code, discount_type=coupon.discount_type, discount_value=coupon.discount_value,
        course_id=coupon.course_id, max_uses=coupon.max_uses, max_uses_per_user=coupon.max_uses_per_user,
        expires_at=coupon.expires_at, is_active=coupon.is_active, created_at=coupon.created_at, use_count=0,
    )


@router.delete("/coupons/{coupon_id}", status_code=204)
async def delete_coupon(coupon_id: uuid.UUID, db: DB, _: CourseAdminUser):
    coupon = await db.scalar(select(Coupon).where(Coupon.id == coupon_id))
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    await db.delete(coupon)


@router.patch("/coupons/{coupon_id}", response_model=CouponResponse)
async def toggle_coupon(coupon_id: uuid.UUID, db: DB, _: CourseAdminUser):
    """Toggle a coupon's active status."""
    coupon = await db.scalar(select(Coupon).where(Coupon.id == coupon_id))
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    coupon.is_active = not coupon.is_active
    await db.flush()
    use_count = await db.scalar(select(func.count(CouponRedemption.id)).where(CouponRedemption.coupon_id == coupon_id)) or 0
    return CouponResponse(
        id=coupon.id, code=coupon.code, discount_type=coupon.discount_type, discount_value=coupon.discount_value,
        course_id=coupon.course_id, max_uses=coupon.max_uses, max_uses_per_user=coupon.max_uses_per_user,
        expires_at=coupon.expires_at, is_active=coupon.is_active, created_at=coupon.created_at, use_count=use_count,
    )


@router.patch("/{course_id}", response_model=CourseListResponse)
async def update_course(course_id: uuid.UUID, payload: CourseUpdate, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    await ensure_course_access(course_id, current_user, db)
    data = payload.model_dump(exclude_unset=True)
    new_prereq_ids = data.pop("prerequisite_course_ids", None)
    access_code = data.pop("access_code", None)
    if access_code is not None:
        data["access_code_hash"] = _hash_access_code(access_code) if access_code else None
    for k, v in data.items():
        setattr(course, k, v)
    if new_prereq_ids is not None:
        existing_rows = (await db.execute(
            select(CoursePrerequisite).where(CoursePrerequisite.course_id == course_id)
        )).scalars().all()
        existing_ids = {row.prerequisite_course_id for row in existing_rows}
        for row in existing_rows:
            if row.prerequisite_course_id not in new_prereq_ids:
                await db.delete(row)
        for prereq_id in new_prereq_ids:
            if prereq_id not in existing_ids and prereq_id != course_id:
                db.add(CoursePrerequisite(course_id=course_id, prerequisite_course_id=prereq_id))
    await db.flush()
    count = await _get_enrollment_count(course_id, db)
    data = _add_enrollment_count(course, count)
    return CourseListResponse(**data)


@router.delete("/{course_id}", status_code=204)
async def delete_course(course_id: uuid.UUID, db: DB, current_user: CourseAdminUser):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    await ensure_course_access(course_id, current_user, db)
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
        is_private=course.is_private,
        estimated_hours=course.estimated_hours, tags=course.tags,
        instructor_name=course.instructor_name,
        enrollment_count=0,
        sections=[build_section_public(s) for s in top_sections],
    )


# ── Course Ratings ────────────────────────────────────────────────────────────

@router.get("/{course_id}/ratings/summary", response_model=RatingSummary)
async def get_course_rating_summary(course_id: uuid.UUID, db: DB):
    result = await db.execute(
        select(CourseRating).where(CourseRating.course_id == course_id)
    )
    ratings = result.scalars().all()
    if not ratings:
        return RatingSummary(avg_rating=0.0, rating_count=0, distribution={})
    avg = sum(r.rating for r in ratings) / len(ratings)
    dist = {i: 0 for i in range(1, 6)}
    for r in ratings:
        dist[r.rating] = dist.get(r.rating, 0) + 1
    return RatingSummary(avg_rating=round(avg, 1), rating_count=len(ratings), distribution=dist)


@router.get("/{course_id}/ratings", response_model=List[CourseRatingResponse])
async def list_course_ratings(course_id: uuid.UUID, db: DB, skip: int = 0, limit: int = 20):
    result = await db.execute(
        select(CourseRating)
        .where(CourseRating.course_id == course_id)
        .order_by(CourseRating.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = result.scalars().all()
    out = []
    for r in rows:
        user_result = await db.execute(select(User).where(User.id == r.user_id))
        user = user_result.scalar_one_or_none()
        out.append(CourseRatingResponse(
            id=r.id, user_id=r.user_id, course_id=r.course_id,
            rating=r.rating, review=r.review,
            author_name=user.full_name if user else "Anonymous",
            created_at=r.created_at, updated_at=r.updated_at,
        ))
    return out


@router.get("/{course_id}/ratings/me", response_model=Optional[CourseRatingResponse])
async def get_my_course_rating(course_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(CourseRating).where(
            CourseRating.course_id == course_id,
            CourseRating.user_id == current_user.id,
        )
    )
    r = result.scalar_one_or_none()
    if not r:
        return None
    return CourseRatingResponse(
        id=r.id, user_id=r.user_id, course_id=r.course_id,
        rating=r.rating, review=r.review,
        author_name=current_user.full_name,
        created_at=r.created_at, updated_at=r.updated_at,
    )


@router.post("/{course_id}/rate", response_model=CourseRatingResponse)
async def rate_course(course_id: uuid.UUID, payload: CourseRatingCreate, db: DB, current_user: CurrentUser):
    """Submit or update a rating. User must be enrolled in the course."""
    enroll_result = await db.execute(
        select(Enrollment).where(
            Enrollment.course_id == course_id,
            Enrollment.user_id == current_user.id,
        )
    )
    if not enroll_result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="You must be enrolled to rate this course.")

    existing = await db.execute(
        select(CourseRating).where(
            CourseRating.course_id == course_id,
            CourseRating.user_id == current_user.id,
        )
    )
    rating = existing.scalar_one_or_none()
    if rating:
        rating.rating = payload.rating
        rating.review = payload.review
        rating.updated_at = datetime.now(timezone.utc)
    else:
        rating = CourseRating(
            user_id=current_user.id,
            course_id=course_id,
            rating=payload.rating,
            review=payload.review,
        )
        db.add(rating)
    await db.flush()
    return CourseRatingResponse(
        id=rating.id, user_id=rating.user_id, course_id=rating.course_id,
        rating=rating.rating, review=rating.review,
        author_name=current_user.full_name,
        created_at=rating.created_at, updated_at=rating.updated_at,
    )


@router.delete("/{course_id}/rate", status_code=204)
async def delete_course_rating(course_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(CourseRating).where(
            CourseRating.course_id == course_id,
            CourseRating.user_id == current_user.id,
        )
    )
    rating = result.scalar_one_or_none()
    if rating:
        await db.delete(rating)
        await db.flush()
