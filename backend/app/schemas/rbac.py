from datetime import datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel
from app.models.rbac import ALL_PERMISSIONS, PERMISSION_LABELS


class StaffRoleCreate(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    permissions: list[str]

    def validate_permissions(self) -> "StaffRoleCreate":
        invalid = [p for p in self.permissions if p not in ALL_PERMISSIONS]
        if invalid:
            raise ValueError(f"Unknown permissions: {invalid}")
        return self


class StaffRoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[list[str]] = None


class StaffRoleResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str]
    permissions: list[str]
    is_system: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class AssignRoleRequest(BaseModel):
    user_id: UUID
    role_id: UUID
    role_metadata: Optional[dict[str, Any]] = None  # e.g. {"course_ids": ["..."]}


class UserStaffRoleResponse(BaseModel):
    id: UUID
    user_id: UUID
    role_id: UUID
    role: StaffRoleResponse
    is_active: bool
    role_metadata: Optional[dict[str, Any]]
    assigned_at: datetime
    user_email: str = ""
    user_name: str = ""
    model_config = {"from_attributes": True}


class PermissionInfo(BaseModel):
    key: str
    label: str


def get_all_permission_info() -> list[PermissionInfo]:
    return [PermissionInfo(key=k, label=v) for k, v in PERMISSION_LABELS.items()]
