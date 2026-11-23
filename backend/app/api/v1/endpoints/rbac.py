import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.api.deps import CurrentUser, DB, SuperAdminUser
from app.models.rbac import ALL_PERMISSIONS, StaffRole, UserStaffRole
from app.models.user import User, UserRole
from app.schemas.rbac import (
    AssignRoleRequest, StaffRoleCreate, StaffRoleResponse, StaffRoleUpdate,
    UserStaffRoleResponse, PermissionInfo, get_all_permission_info,
)

router = APIRouter(prefix="/rbac", tags=["rbac"])


# ── Permissions reference ──────────────────────────────────────────────────────

@router.get("/permissions", response_model=List[PermissionInfo])
async def list_permissions(_: SuperAdminUser):
    return get_all_permission_info()


# ── Staff Roles CRUD ───────────────────────────────────────────────────────────

@router.get("/roles", response_model=List[StaffRoleResponse])
async def list_roles(db: DB, _: SuperAdminUser):
    result = await db.execute(select(StaffRole).order_by(StaffRole.is_system.desc(), StaffRole.name))
    return result.scalars().all()


@router.post("/roles", response_model=StaffRoleResponse, status_code=201)
async def create_role(payload: StaffRoleCreate, db: DB, _: SuperAdminUser):
    invalid = [p for p in payload.permissions if p not in ALL_PERMISSIONS]
    if invalid:
        raise HTTPException(status_code=422, detail=f"Unknown permissions: {invalid}")
    existing = await db.execute(select(StaffRole).where(StaffRole.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A role with this slug already exists.")
    role = StaffRole(
        name=payload.name,
        slug=payload.slug,
        description=payload.description,
        permissions=payload.permissions,
        is_system=False,
    )
    db.add(role)
    await db.flush()
    return role


@router.patch("/roles/{role_id}", response_model=StaffRoleResponse)
async def update_role(role_id: uuid.UUID, payload: StaffRoleUpdate, db: DB, _: SuperAdminUser):
    result = await db.execute(select(StaffRole).where(StaffRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=403, detail="System roles cannot be modified.")
    if payload.name is not None:
        role.name = payload.name
    if payload.description is not None:
        role.description = payload.description
    if payload.permissions is not None:
        invalid = [p for p in payload.permissions if p not in ALL_PERMISSIONS]
        if invalid:
            raise HTTPException(status_code=422, detail=f"Unknown permissions: {invalid}")
        role.permissions = payload.permissions
    await db.flush()
    return role


@router.delete("/roles/{role_id}", status_code=204)
async def delete_role(role_id: uuid.UUID, db: DB, _: SuperAdminUser):
    result = await db.execute(select(StaffRole).where(StaffRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=403, detail="System roles cannot be deleted.")
    await db.delete(role)
    await db.flush()


# ── User Assignments ───────────────────────────────────────────────────────────

@router.get("/assignments", response_model=List[UserStaffRoleResponse])
async def list_assignments(db: DB, _: SuperAdminUser, user_id: Optional[uuid.UUID] = None):
    q = select(UserStaffRole).options(selectinload(UserStaffRole.role), selectinload(UserStaffRole.user))
    if user_id:
        q = q.where(UserStaffRole.user_id == user_id)
    q = q.order_by(UserStaffRole.assigned_at.desc())
    result = await db.execute(q)
    rows = result.scalars().all()
    out = []
    for r in rows:
        resp = UserStaffRoleResponse.model_validate(r)
        if r.user:
            resp.user_email = r.user.email
            resp.user_name = r.user.full_name
        out.append(resp)
    return out


@router.post("/assignments", response_model=UserStaffRoleResponse, status_code=201)
async def assign_role(payload: AssignRoleRequest, db: DB, current_user: SuperAdminUser):
    # Verify user exists
    user_result = await db.execute(select(User).where(User.id == payload.user_id))
    target_user = user_result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify role exists
    role_result = await db.execute(select(StaffRole).where(StaffRole.id == payload.role_id))
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # system_admin role can only be assigned by superadmin (already enforced by SuperAdminUser dep)
    assignment = UserStaffRole(
        user_id=payload.user_id,
        role_id=payload.role_id,
        role_metadata=payload.role_metadata,
        assigned_by_id=current_user.id,
        is_active=True,
    )
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment, ["role", "user"])
    resp = UserStaffRoleResponse.model_validate(assignment)
    resp.user_email = target_user.email
    resp.user_name = target_user.full_name
    return resp


@router.patch("/assignments/{assignment_id}", response_model=UserStaffRoleResponse)
async def update_assignment(
    assignment_id: uuid.UUID,
    is_active: bool,
    db: DB,
    _: SuperAdminUser,
    role_metadata: Optional[dict] = None,
):
    result = await db.execute(
        select(UserStaffRole).options(selectinload(UserStaffRole.role), selectinload(UserStaffRole.user))
        .where(UserStaffRole.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    assignment.is_active = is_active
    if role_metadata is not None:
        assignment.role_metadata = role_metadata
    await db.flush()
    resp = UserStaffRoleResponse.model_validate(assignment)
    if assignment.user:
        resp.user_email = assignment.user.email
        resp.user_name = assignment.user.full_name
    return resp


@router.delete("/assignments/{assignment_id}", status_code=204)
async def remove_assignment(assignment_id: uuid.UUID, db: DB, _: SuperAdminUser):
    result = await db.execute(select(UserStaffRole).where(UserStaffRole.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    await db.delete(assignment)
    await db.flush()


# ── Staff user listing for assignment UI ──────────────────────────────────────

@router.get("/users", response_model=List[dict])
async def list_assignable_users(db: DB, _: SuperAdminUser, search: str = ""):
    """List non-admin users that can be assigned staff roles."""
    q = select(User).where(User.role == UserRole.USER, User.is_active == True)
    if search:
        q = q.where(User.email.ilike(f"%{search}%") | User.full_name.ilike(f"%{search}%"))
    q = q.order_by(User.full_name).limit(50)
    result = await db.execute(q)
    return [{"id": str(u.id), "email": u.email, "full_name": u.full_name} for u in result.scalars()]
