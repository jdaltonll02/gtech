import uuid
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum as PyEnum
from typing import Optional
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base


class CourseLevel(str, PyEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"


class LessonType(str, PyEnum):
    VIDEO = "video"
    TEXT = "text"
    CODE = "code"
    DOCUMENT = "document"
    MIXED = "mixed"


class ContentBlockType(str, PyEnum):
    TEXT = "text"
    VIDEO = "video"
    IMAGE = "image"
    CODE = "code"


class AssessmentType(str, PyEnum):
    QUIZ = "quiz"
    ASSIGNMENT = "assignment"
    PROJECT = "project"


class EnrollmentStatus(str, PyEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    DROPPED = "dropped"


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    short_description: Mapped[Optional[str]] = mapped_column(String(500))
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(1000))
    level: Mapped[CourseLevel] = mapped_column(Enum(CourseLevel, values_callable=lambda x: [e.value for e in x]), default=CourseLevel.BEGINNER)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"))
    is_free: Mapped[bool] = mapped_column(Boolean, default=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    estimated_hours: Mapped[Optional[float]] = mapped_column(Float)
    tags: Mapped[Optional[str]] = mapped_column(String(500))
    instructor_name: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    sections: Mapped[list["Section"]] = relationship(
        "Section", back_populates="course", cascade="all, delete-orphan",
        primaryjoin="and_(Section.course_id == Course.id, Section.parent_id == None)",
        order_by="Section.order_index", lazy="select",
    )
    all_sections: Mapped[list["Section"]] = relationship(
        "Section", back_populates="course", cascade="all, delete-orphan",
        foreign_keys="Section.course_id", overlaps="sections",
    )
    enrollments: Mapped[list["Enrollment"]] = relationship("Enrollment", back_populates="course")


class Section(Base):
    __tablename__ = "course_sections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"))
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("course_sections.id", ondelete="CASCADE"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    course: Mapped["Course"] = relationship("Course", back_populates="all_sections", foreign_keys=[course_id], overlaps="sections,all_sections")
    parent: Mapped[Optional["Section"]] = relationship("Section", remote_side="Section.id", back_populates="sub_sections")
    sub_sections: Mapped[list["Section"]] = relationship(
        "Section", back_populates="parent", cascade="all, delete-orphan",
        order_by="Section.order_index",
    )
    lessons: Mapped[list["Lesson"]] = relationship(
        "Lesson", back_populates="section", cascade="all, delete-orphan", order_by="Lesson.order_index"
    )


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    section_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("course_sections.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    lesson_type: Mapped[LessonType] = mapped_column(Enum(LessonType, values_callable=lambda x: [e.value for e in x]), default=LessonType.MIXED)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    # Legacy single-block fields (kept for backward compat)
    video_url: Mapped[Optional[str]] = mapped_column(String(1000))
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer)
    content: Mapped[Optional[str]] = mapped_column(Text)
    is_preview: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    section: Mapped["Section"] = relationship("Section", back_populates="lessons")
    content_blocks: Mapped[list["ContentBlock"]] = relationship(
        "ContentBlock", back_populates="lesson", cascade="all, delete-orphan", order_by="ContentBlock.order_index"
    )
    assessments: Mapped[list["Assessment"]] = relationship(
        "Assessment", back_populates="lesson", cascade="all, delete-orphan", order_by="Assessment.order_index"
    )
    progress_records: Mapped[list["LessonProgress"]] = relationship("LessonProgress", back_populates="lesson")


class ContentBlock(Base):
    """A single content block inside a lesson (text, video, image, or code)."""
    __tablename__ = "content_blocks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"))
    block_type: Mapped[ContentBlockType] = mapped_column(Enum(ContentBlockType, values_callable=lambda x: [e.value for e in x], native_enum=False), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    # Text / Code
    content: Mapped[Optional[str]] = mapped_column(Text)
    language: Mapped[Optional[str]] = mapped_column(String(50))  # for code blocks
    # Video
    video_url: Mapped[Optional[str]] = mapped_column(String(1000))
    video_caption: Mapped[Optional[str]] = mapped_column(String(500))
    duration_seconds: Mapped[Optional[int]] = mapped_column(Integer)
    # Image
    image_url: Mapped[Optional[str]] = mapped_column(String(1000))
    image_caption: Mapped[Optional[str]] = mapped_column(String(500))
    image_alt: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="content_blocks")


class Assessment(Base):
    """Quiz, Assignment, or Project attached to a lesson."""
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"))
    assessment_type: Mapped[AssessmentType] = mapped_column(Enum(AssessmentType, values_callable=lambda x: [e.value for e in x], native_enum=False), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    instructions: Mapped[Optional[str]] = mapped_column(Text)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=True)
    passing_score: Mapped[Optional[int]] = mapped_column(Integer)  # percentage, for quizzes
    time_limit_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="assessments")
    questions: Mapped[list["QuizQuestion"]] = relationship(
        "QuizQuestion", back_populates="assessment", cascade="all, delete-orphan", order_by="QuizQuestion.order_index"
    )


class QuizQuestion(Base):
    """A question inside a Quiz assessment."""
    __tablename__ = "quiz_questions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assessment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"))
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    # options stored as JSON list of strings
    options: Mapped[list] = mapped_column(JSON, default=list)
    correct_answer_index: Mapped[int] = mapped_column(Integer, default=0)
    explanation: Mapped[Optional[str]] = mapped_column(Text)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    assessment: Mapped["Assessment"] = relationship("Assessment", back_populates="questions")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"))
    status: Mapped[EnrollmentStatus] = mapped_column(Enum(EnrollmentStatus, values_callable=lambda x: [e.value for e in x]), default=EnrollmentStatus.ACTIVE)
    progress_percent: Mapped[float] = mapped_column(Float, default=0.0)
    last_accessed_lesson_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    course: Mapped["Course"] = relationship("Course", back_populates="enrollments")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], lazy="select")
    lesson_progress: Mapped[list["LessonProgress"]] = relationship(
        "LessonProgress", back_populates="enrollment", cascade="all, delete-orphan"
    )
    certificate: Mapped[Optional["Certificate"]] = relationship("Certificate", back_populates="enrollment", uselist=False)


class LessonProgress(Base):
    __tablename__ = "lesson_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("enrollments.id", ondelete="CASCADE"))
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"))
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    watch_position_seconds: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    enrollment: Mapped["Enrollment"] = relationship("Enrollment", back_populates="lesson_progress")
    lesson: Mapped["Lesson"] = relationship("Lesson", back_populates="progress_records")


class Certificate(Base):
    __tablename__ = "certificates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("enrollments.id", ondelete="CASCADE"), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"))
    certificate_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    enrollment: Mapped["Enrollment"] = relationship("Enrollment", back_populates="certificate")
    course: Mapped["Course"] = relationship("Course")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enrollment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("enrollments.id", ondelete="CASCADE"), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"))
    badge_type: Mapped[str] = mapped_column(String(50), nullable=False, default="course_completion")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    enrollment: Mapped["Enrollment"] = relationship("Enrollment")
    course: Mapped["Course"] = relationship("Course")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class CoursePaymentStatus(str, PyEnum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"


class CoursePayment(Base):
    """Records a Stripe PaymentIntent raised for purchasing a paid course."""
    __tablename__ = "course_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    payment_intent_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[CoursePaymentStatus] = mapped_column(
        Enum(CoursePaymentStatus, values_callable=lambda x: [e.value for e in x], native_enum=False),
        default=CoursePaymentStatus.PENDING,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
