from uuid import UUID
from pydantic import BaseModel, EmailStr, field_serializer, field_validator, computed_field
import re


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str
    password: str

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a digit")
        return v

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Full name cannot be empty")
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    two_factor_enabled: bool = False
    permissions: list[str] = []
    bio: str | None = None
    headline: str | None = None
    job_title: str | None = None
    company: str | None = None
    school: str | None = None
    phone: str | None = None
    website: str | None = None
    city: str | None = None
    country: str | None = None
    address: str | None = None
    linkedin_url: str | None = None
    twitter_url: str | None = None
    github_url: str | None = None

    model_config = {"from_attributes": True}

    @field_serializer("id")
    def serialize_id(self, v: UUID) -> str:
        return str(v)

    @computed_field
    @property
    def is_admin(self) -> bool:
        return self.role in ("admin", "superadmin")


class UpdateProfileRequest(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    current_password: str | None = None
    new_password: str | None = None
    bio: str | None = None
    headline: str | None = None
    job_title: str | None = None
    company: str | None = None
    school: str | None = None
    phone: str | None = None
    website: str | None = None
    city: str | None = None
    country: str | None = None
    address: str | None = None
    linkedin_url: str | None = None
    twitter_url: str | None = None
    github_url: str | None = None

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Full name cannot be empty")
        return v.strip() if v else v

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain an uppercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain a digit")
        return v
