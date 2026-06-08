from uuid import UUID
from typing import Optional
from pydantic import BaseModel, field_serializer


def _str_uuid(v: UUID) -> str:
    return str(v)


# ── Experience ────────────────────────────────────────────────────────────────

class TeamMemberExperienceCreate(BaseModel):
    company: str
    position: str
    duration: str
    location: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0


class TeamMemberExperienceUpdate(BaseModel):
    company: Optional[str] = None
    position: Optional[str] = None
    duration: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


class TeamMemberExperienceResponse(BaseModel):
    id: UUID
    team_member_id: UUID
    company: str
    position: str
    duration: str
    location: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0

    model_config = {"from_attributes": True}

    @field_serializer("id", "team_member_id")
    def serialize_uuid(self, v: UUID) -> str:
        return str(v)


# ── Education ────────────────────────────────────────────────────────────────

class TeamMemberEducationCreate(BaseModel):
    institution: str
    degree: str
    field_of_study: str
    start_year: str
    end_year: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0


class TeamMemberEducationUpdate(BaseModel):
    institution: Optional[str] = None
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    start_year: Optional[str] = None
    end_year: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


class TeamMemberEducationResponse(BaseModel):
    id: UUID
    team_member_id: UUID
    institution: str
    degree: str
    field_of_study: str
    start_year: str
    end_year: Optional[str] = None
    description: Optional[str] = None
    order_index: int = 0

    model_config = {"from_attributes": True}

    @field_serializer("id", "team_member_id")
    def serialize_uuid(self, v: UUID) -> str:
        return str(v)


# ── Project ────────────────────────────────────────────────────────────────

class TeamMemberProjectCreate(BaseModel):
    title: str
    description: str
    tech_stack: list[str] = []
    github_url: Optional[str] = None
    live_url: Optional[str] = None
    image_url: Optional[str] = None
    order_index: int = 0


class TeamMemberProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    tech_stack: Optional[list[str]] = None
    github_url: Optional[str] = None
    live_url: Optional[str] = None
    image_url: Optional[str] = None
    order_index: Optional[int] = None


class TeamMemberProjectResponse(BaseModel):
    id: UUID
    team_member_id: UUID
    title: str
    description: str
    tech_stack: list[str] = []
    github_url: Optional[str] = None
    live_url: Optional[str] = None
    image_url: Optional[str] = None
    order_index: int = 0

    model_config = {"from_attributes": True}

    @field_serializer("id", "team_member_id")
    def serialize_uuid(self, v: UUID) -> str:
        return str(v)


# ── Team Member ────────────────────────────────────────────────────────────────

class TeamMemberCreate(BaseModel):
    slug: str
    full_name: str
    title: str
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    headline: Optional[str] = None
    display_order: int = 0
    is_active: bool = True
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    github_url: Optional[str] = None
    website: Optional[str] = None


class TeamMemberUpdate(BaseModel):
    slug: Optional[str] = None
    full_name: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    headline: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    github_url: Optional[str] = None
    website: Optional[str] = None


class TeamMemberResponse(BaseModel):
    id: UUID
    slug: str
    full_name: str
    title: str
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    headline: Optional[str] = None
    display_order: int = 0
    is_active: bool = True
    linkedin_url: Optional[str] = None
    twitter_url: Optional[str] = None
    github_url: Optional[str] = None
    website: Optional[str] = None

    model_config = {"from_attributes": True}

    @field_serializer("id")
    def serialize_id(self, v: UUID) -> str:
        return str(v)


# ── Certification ────────────────────────────────────────────────────────────

class TeamMemberCertificationCreate(BaseModel):
    title: str
    issuer: str
    date: str
    credential_url: Optional[str] = None
    order_index: int = 0


class TeamMemberCertificationUpdate(BaseModel):
    title: Optional[str] = None
    issuer: Optional[str] = None
    date: Optional[str] = None
    credential_url: Optional[str] = None
    order_index: Optional[int] = None


class TeamMemberCertificationResponse(BaseModel):
    id: UUID
    team_member_id: UUID
    title: str
    issuer: str
    date: str
    credential_url: Optional[str] = None
    order_index: int = 0

    model_config = {"from_attributes": True}

    @field_serializer("id", "team_member_id")
    def serialize_uuid(self, v: UUID) -> str:
        return str(v)


class TeamMemberDetailResponse(TeamMemberResponse):
    experiences: list[TeamMemberExperienceResponse] = []
    educations: list[TeamMemberEducationResponse] = []
    projects: list[TeamMemberProjectResponse] = []
    certifications: list[TeamMemberCertificationResponse] = []
