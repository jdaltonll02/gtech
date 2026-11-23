from typing import Annotated, Optional
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.security import decode_token
from app.db.redis import is_token_revoked, was_issued_before_pw_change
from app.db.session import get_db
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer()
bearer_scheme_optional = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(credentials.credentials, expected_type="access")
    user_id = payload.get("sub")
    jti = payload.get("jti")
    iat = payload.get("iat", 0)

    # Reject revoked tokens (logout) and tokens issued before a password change
    if jti and await is_token_revoked(jti):
        raise credentials_exception
    if user_id and await was_issued_before_pw_change(user_id, float(iat)):
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_role(*roles: UserRole):
    async def _guard(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user
    return _guard


require_admin = require_role(UserRole.ADMIN, UserRole.SUPERADMIN)
require_superadmin = require_role(UserRole.SUPERADMIN)


async def get_optional_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(bearer_scheme_optional)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Optional[User]:
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials, expected_type="access")
        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
        user = result.scalar_one_or_none()
        return user if user and user.is_active else None
    except Exception:
        return None


async def _get_user_permissions(user_id: uuid.UUID, db: AsyncSession) -> set:
    """Return the set of permission strings for a staff user."""
    from app.models.rbac import UserStaffRole
    result = await db.execute(
        select(UserStaffRole)
        .options(selectinload(UserStaffRole.role))
        .where(UserStaffRole.user_id == user_id, UserStaffRole.is_active == True)
    )
    assignments = result.scalars().all()
    perms: set = set()
    for a in assignments:
        if a.role and a.role.permissions:
            perms.update(a.role.permissions)
    return perms


def require_permission(*permissions: str):
    """Allow access if user is admin/superadmin OR has ANY of the listed permissions."""
    async def _guard(
        credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
        db: Annotated[AsyncSession, Depends(get_db)],
    ) -> User:
        user = await get_current_user(credentials, db)
        if user.role in (UserRole.ADMIN, UserRole.SUPERADMIN):
            return user
        user_perms = await _get_user_permissions(user.id, db)
        if any(p in user_perms for p in permissions):
            return user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return _guard


async def get_user_effective_permissions(user: User, db: AsyncSession) -> list[str]:
    """Get the full list of permissions for the /me endpoint response."""
    from app.models.rbac import ALL_PERMISSIONS
    if user.role in (UserRole.ADMIN, UserRole.SUPERADMIN):
        return list(ALL_PERMISSIONS)
    perms = await _get_user_permissions(user.id, db)
    return list(perms)


async def get_user_assigned_course_ids(current_user: User, db: AsyncSession) -> Optional[list[uuid.UUID]]:
    """
    Returns None if the user has full course access — either the primary
    ADMIN/SUPERADMIN role, or the manage_courses RBAC permission. The primary
    superadmin typically has no UserStaffRole rows at all (RBAC assignments
    are for staff/instructor accounts, not the seeded superadmin), so the role
    check must happen here rather than being left to each caller.
    Returns a list of course IDs for instructors (manage_own_courses), scoped
    via the CourseInstructor table — empty if none are assigned yet.
    """
    if current_user.role in (UserRole.ADMIN, UserRole.SUPERADMIN):
        return None
    from app.models.rbac import UserStaffRole
    from app.models.courses import CourseInstructor
    result = await db.execute(
        select(UserStaffRole)
        .options(selectinload(UserStaffRole.role))
        .where(UserStaffRole.user_id == current_user.id, UserStaffRole.is_active == True)
    )
    assignments = result.scalars().all()
    has_own_courses_perm = False
    for a in assignments:
        if not a.role:
            continue
        perms = a.role.permissions or []
        if "manage_courses" in perms:
            return None  # Full access
        if "manage_own_courses" in perms:
            has_own_courses_perm = True
    if not has_own_courses_perm:
        return []
    result = await db.execute(select(CourseInstructor.course_id).where(CourseInstructor.user_id == current_user.id))
    return list(result.scalars().all())


async def ensure_course_access(course_id: uuid.UUID, current_user: User, db: AsyncSession) -> None:
    """Raise 403 if current_user can't manage this specific course.

    ADMIN/SUPERADMIN and manage_courses holders (get_user_assigned_course_ids
    returns None) always pass. manage_own_courses holders (instructors) only
    pass if the course is in their assigned list.
    """
    assigned = await get_user_assigned_course_ids(current_user, db)
    if assigned is None:
        return
    if course_id not in assigned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this course")


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[Optional[User], Depends(get_optional_user)]
AdminUser = Annotated[User, Depends(require_admin)]
SuperAdminUser = Annotated[User, Depends(require_superadmin)]
DB = Annotated[AsyncSession, Depends(get_db)]

# Permission-specific type aliases
CourseAdminUser = Annotated[User, Depends(require_permission("manage_courses", "manage_own_courses"))]
EcommerceAdminUser = Annotated[User, Depends(require_permission("manage_ecommerce"))]
BlogAdminUser = Annotated[User, Depends(require_permission("manage_blog"))]
SupportAdminUser = Annotated[User, Depends(require_permission("manage_tickets"))]
PortfolioAdminUser = Annotated[User, Depends(require_permission("manage_portfolio"))]
MediaAdminUser = Annotated[User, Depends(require_permission("manage_media"))]
FormsAdminUser = Annotated[User, Depends(require_permission("manage_forms"))]
PartnersAdminUser = Annotated[User, Depends(require_permission("manage_partners"))]
AnalyticsUser = Annotated[User, Depends(require_permission("view_analytics"))]
