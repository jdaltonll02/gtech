from uuid import UUID
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, EmailStr


class UserRole(str, Enum):
    user = "user"
    admin = "admin"
    superadmin = "superadmin"


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    is_verified: bool | None = None