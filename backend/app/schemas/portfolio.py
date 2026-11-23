from typing import Optional
from uuid import UUID
from pydantic import BaseModel, HttpUrl


# ── Project ──────────────────────────────────────────────────────────────────

class ProjectCollaborator(BaseModel):
    name: str
    role: Optional[str] = None
    url: Optional[str] = None


class ProjectBase(BaseModel):
    title: str
    description: str
    category: str
    tags: list[str] = []
    github_url: Optional[str] = None
    live_url: Optional[str] = None
    image_url: Optional[str] = None
    featured: bool = False
    order_index: int = 0
    tagline: Optional[str] = None
    status: str = "in_progress"
    pitch_summary: Optional[str] = None
    problem_statement: Optional[str] = None
    solution: Optional[str] = None
    collaborators: list[ProjectCollaborator] = []
    gallery_urls: list[str] = []
    looking_for: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    github_url: Optional[str] = None
    live_url: Optional[str] = None
    image_url: Optional[str] = None
    featured: Optional[bool] = None
    order_index: Optional[int] = None
    tagline: Optional[str] = None
    status: Optional[str] = None
    pitch_summary: Optional[str] = None
    problem_statement: Optional[str] = None
    solution: Optional[str] = None
    collaborators: Optional[list[ProjectCollaborator]] = None
    gallery_urls: Optional[list[str]] = None
    looking_for: Optional[str] = None


class ProjectResponse(ProjectBase):
    id: UUID
    model_config = {"from_attributes": True}


# ── Experience ────────────────────────────────────────────────────────────────

class ExperienceBase(BaseModel):
    company: str
    position: str
    duration: str
    location: str
    description: str
    achievements: list[str] = []
    order_index: int = 0


class ExperienceCreate(ExperienceBase):
    pass


class ExperienceUpdate(BaseModel):
    company: Optional[str] = None
    position: Optional[str] = None
    duration: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    achievements: Optional[list[str]] = None
    order_index: Optional[int] = None


class ExperienceResponse(ExperienceBase):
    id: UUID
    model_config = {"from_attributes": True}


# ── Education ─────────────────────────────────────────────────────────────────

class EducationBase(BaseModel):
    institution: str
    degree: str
    field_of_study: str
    start_year: str
    end_year: Optional[str] = None
    gpa: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0


class EducationCreate(EducationBase):
    pass


class EducationUpdate(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_year: Optional[str] = None
    end_year: Optional[str] = None
    gpa: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


class EducationResponse(EducationBase):
    id: UUID
    model_config = {"from_attributes": True}


# ── Certification ─────────────────────────────────────────────────────────────

class CertificationBase(BaseModel):
    title: str
    issuer: str
    date: str
    credential_url: Optional[str] = None
    image_url: Optional[str] = None
    order_index: int = 0


class CertificationCreate(CertificationBase):
    pass


class CertificationUpdate(BaseModel):
    title: Optional[str] = None
    issuer: Optional[str] = None
    date: Optional[str] = None
    credential_url: Optional[str] = None
    image_url: Optional[str] = None
    order_index: Optional[int] = None


class CertificationResponse(CertificationBase):
    id: UUID
    model_config = {"from_attributes": True}


# ── Skill ────────────────────────────────────────────────────────────────────

class SkillCreate(BaseModel):
    category: str
    name: str
    order_index: int = 0


class SkillUpdate(BaseModel):
    category: Optional[str] = None
    name: Optional[str] = None
    order_index: Optional[int] = None


class SkillResponse(BaseModel):
    id: UUID
    category: str
    name: str
    order_index: int
    model_config = {"from_attributes": True}


# ── Publication ───────────────────────────────────────────────────────────────

class PublicationBase(BaseModel):
    title: str
    authors: str
    venue: str
    year: str
    abstract: Optional[str] = None
    link: Optional[str] = None
    doi: Optional[str] = None
    order_index: int = 0


class PublicationCreate(PublicationBase):
    pass


class PublicationUpdate(BaseModel):
    title: Optional[str] = None
    authors: Optional[str] = None
    venue: Optional[str] = None
    year: Optional[str] = None
    abstract: Optional[str] = None
    link: Optional[str] = None
    doi: Optional[str] = None
    order_index: Optional[int] = None


class PublicationResponse(PublicationBase):
    id: UUID
    model_config = {"from_attributes": True}


# ── Profile Settings ──────────────────────────────────────────────────────────

class ProfileSettingsResponse(BaseModel):
    eyebrow: str = "Personal Portfolio"
    full_name: str = "John Dalton Gibson"
    title: str = "AI/ML Engineer & CMU Graduate Student"
    subtitle: str = "Specializing in Computer Vision, Robotics, and Deep Learning"
    focus_paragraph_1: Optional[str] = "Designing production-ready digital systems that combine strong interface design with real operational depth."
    focus_paragraph_2: Optional[str] = "Working across intelligent applications, platform architecture, learning systems, and tools that help organizations scale without chaos."
    resume_url: str = "/resume.pdf"
    resume_filename: str = "John-Dalton-Gibson-Resume.pdf"
    github_url: str = "https://github.com"
    profile_photo_url: Optional[str] = None
    portfolio_eyebrow: str = "Portfolio"
    portfolio_subtitle: str = "Explore my work in AI, Machine Learning, and Robotics"
    model_config = {"from_attributes": True}


class ProfileSettingsUpdate(BaseModel):
    eyebrow: Optional[str] = None
    full_name: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    focus_paragraph_1: Optional[str] = None
    focus_paragraph_2: Optional[str] = None
    resume_url: Optional[str] = None
    resume_filename: Optional[str] = None
    github_url: Optional[str] = None
    profile_photo_url: Optional[str] = None
    portfolio_eyebrow: Optional[str] = None
    portfolio_subtitle: Optional[str] = None
