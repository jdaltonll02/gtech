from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from app.models.courses import AssessmentType, ContentBlockType, CourseLevel, EnrollmentStatus, LessonType


# ── Content Block ─────────────────────────────────────────────────────────────

class ContentBlockCreate(BaseModel):
    block_type: ContentBlockType
    order_index: int = 0
    content: Optional[str] = None
    language: Optional[str] = None
    video_url: Optional[str] = None
    video_caption: Optional[str] = None
    duration_seconds: Optional[int] = None
    image_url: Optional[str] = None
    image_caption: Optional[str] = None
    image_alt: Optional[str] = None


class ContentBlockUpdate(BaseModel):
    block_type: Optional[ContentBlockType] = None
    order_index: Optional[int] = None
    content: Optional[str] = None
    language: Optional[str] = None
    video_url: Optional[str] = None
    video_caption: Optional[str] = None
    duration_seconds: Optional[int] = None
    image_url: Optional[str] = None
    image_caption: Optional[str] = None
    image_alt: Optional[str] = None


class ContentBlockResponse(BaseModel):
    id: UUID
    lesson_id: UUID
    block_type: ContentBlockType
    order_index: int
    content: Optional[str]
    language: Optional[str]
    video_url: Optional[str]
    video_caption: Optional[str]
    duration_seconds: Optional[int]
    image_url: Optional[str]
    image_caption: Optional[str]
    image_alt: Optional[str]
    model_config = {"from_attributes": True}


# ── Quiz Question ─────────────────────────────────────────────────────────────

class QuizQuestionCreate(BaseModel):
    question_text: str
    options: list[str]
    correct_answer_index: int = 0
    explanation: Optional[str] = None
    order_index: int = 0


class QuizQuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    options: Optional[list[str]] = None
    correct_answer_index: Optional[int] = None
    explanation: Optional[str] = None
    order_index: Optional[int] = None


class QuizQuestionResponse(BaseModel):
    id: UUID
    assessment_id: UUID
    question_text: str
    options: list[str]
    correct_answer_index: int
    explanation: Optional[str]
    order_index: int
    model_config = {"from_attributes": True}


# ── Assessment ────────────────────────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    assessment_type: AssessmentType
    title: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    is_mandatory: bool = True
    passing_score: Optional[int] = None
    time_limit_minutes: Optional[int] = None
    order_index: int = 0


class AssessmentUpdate(BaseModel):
    assessment_type: Optional[AssessmentType] = None
    title: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    is_mandatory: Optional[bool] = None
    passing_score: Optional[int] = None
    time_limit_minutes: Optional[int] = None
    order_index: Optional[int] = None


class AssessmentResponse(BaseModel):
    id: UUID
    lesson_id: UUID
    assessment_type: AssessmentType
    title: str
    description: Optional[str]
    instructions: Optional[str]
    is_mandatory: bool
    passing_score: Optional[int]
    time_limit_minutes: Optional[int]
    order_index: int
    questions: list[QuizQuestionResponse] = []
    model_config = {"from_attributes": True}


# ── Quiz Attempt ──────────────────────────────────────────────────────────────

class QuizSubmit(BaseModel):
    answers: list[int]  # one selected option index per question, in order


class QuizAttemptResponse(BaseModel):
    id: UUID
    assessment_id: UUID
    score_percent: float
    passed: bool
    attempt_number: int
    answers: list[int]
    submitted_at: datetime
    results: list[dict] = []  # [{question_text, your_answer, correct_answer, correct, explanation}]
    model_config = {"from_attributes": True}


# ── Lesson ────────────────────────────────────────────────────────────────────

class LessonCreate(BaseModel):
    title: str
    lesson_type: LessonType = LessonType.MIXED
    order_index: int = 0
    video_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    content: Optional[str] = None
    is_preview: bool = False


class LessonUpdate(BaseModel):
    title: Optional[str] = None
    lesson_type: Optional[LessonType] = None
    order_index: Optional[int] = None
    video_url: Optional[str] = None
    duration_seconds: Optional[int] = None
    content: Optional[str] = None
    is_preview: Optional[bool] = None


class LessonResponse(BaseModel):
    id: UUID
    section_id: UUID
    title: str
    lesson_type: LessonType
    order_index: int
    duration_seconds: Optional[int]
    is_preview: bool
    model_config = {"from_attributes": True}


class LessonDetailResponse(LessonResponse):
    video_url: Optional[str]
    content: Optional[str]
    content_blocks: list[ContentBlockResponse] = []
    assessments: list[AssessmentResponse] = []


# ── Section ───────────────────────────────────────────────────────────────────

class SectionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: int = 0
    parent_id: Optional[UUID] = None


class SectionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None
    parent_id: Optional[UUID] = None


class SectionResponse(BaseModel):
    id: UUID
    course_id: UUID
    parent_id: Optional[UUID]
    title: str
    description: Optional[str]
    order_index: int
    lessons: list[LessonResponse] = []
    sub_sections: list["SectionResponse"] = []
    model_config = {"from_attributes": True}


SectionResponse.model_rebuild()


# ── Reorder ───────────────────────────────────────────────────────────────────

class ReorderItem(BaseModel):
    id: UUID
    order_index: int


class ReorderRequest(BaseModel):
    items: list[ReorderItem]


# ── Course ────────────────────────────────────────────────────────────────────

class CourseCreate(BaseModel):
    title: str
    slug: str
    description: str
    short_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    level: CourseLevel = CourseLevel.BEGINNER
    price: Decimal = Decimal("0.00")
    is_free: bool = True
    estimated_hours: Optional[float] = None
    tags: Optional[str] = None
    instructor_name: Optional[str] = None


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    thumbnail_url: Optional[str] = None
    level: Optional[CourseLevel] = None
    price: Optional[Decimal] = None
    is_free: Optional[bool] = None
    is_published: Optional[bool] = None
    estimated_hours: Optional[float] = None
    tags: Optional[str] = None
    instructor_name: Optional[str] = None


class CourseListResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    short_description: Optional[str]
    thumbnail_url: Optional[str]
    level: CourseLevel
    price: Decimal
    is_free: bool
    is_published: bool
    estimated_hours: Optional[float]
    tags: Optional[str]
    instructor_name: Optional[str]
    enrollment_count: int = 0
    model_config = {"from_attributes": True, "populate_by_name": True}


class CourseDetailResponse(CourseListResponse):
    description: str
    sections: list[SectionResponse] = []


# ── Enrollment ────────────────────────────────────────────────────────────────

class EnrollmentResponse(BaseModel):
    id: UUID
    course_id: UUID
    status: EnrollmentStatus
    progress_percent: float
    last_accessed_lesson_id: Optional[UUID]
    enrolled_at: datetime
    completed_at: Optional[datetime]
    course: CourseListResponse
    model_config = {"from_attributes": True}


class EnrollmentAdminResponse(BaseModel):
    id: UUID
    user_id: UUID
    course_id: UUID
    status: EnrollmentStatus
    progress_percent: float
    enrolled_at: datetime
    completed_at: Optional[datetime]
    user_email: str = ""
    user_name: str = ""
    model_config = {"from_attributes": True}


# ── Progress ──────────────────────────────────────────────────────────────────

class ProgressUpdate(BaseModel):
    is_completed: bool = False
    watch_position_seconds: int = 0


class LessonProgressResponse(BaseModel):
    lesson_id: UUID
    is_completed: bool
    watch_position_seconds: int
    completed_at: Optional[datetime]
    progress_percent: float = 0.0  # enrollment-level progress, echoed back
    model_config = {"from_attributes": True}


# ── Certificate ───────────────────────────────────────────────────────────────

class CertificateResponse(BaseModel):
    id: UUID
    enrollment_id: UUID
    course_id: UUID
    certificate_number: str
    issued_at: datetime
    course: CourseListResponse
    model_config = {"from_attributes": True}


class CertificatePublicResponse(BaseModel):
    valid: bool
    certificate_number: str
    course_title: str
    issued_at: datetime
    recipient_name: str
    instructor_name: Optional[str] = None
    estimated_hours: Optional[float] = None
    level: Optional[str] = None


# ── Course Payment ─────────────────────────────────────────────────────────────

class CoursePaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: Decimal
    course_id: UUID


class ConfirmCoursePaymentRequest(BaseModel):
    payment_intent_id: str
