import uuid
from typing import List
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from app.api.deps import PortfolioAdminUser, DB
from app.models.team import TeamMember, TeamMemberEducation, TeamMemberExperience, TeamMemberProject, TeamMemberCertification
from app.schemas.team import (
    TeamMemberCreate, TeamMemberUpdate, TeamMemberResponse, TeamMemberDetailResponse,
    TeamMemberExperienceCreate, TeamMemberExperienceUpdate, TeamMemberExperienceResponse,
    TeamMemberEducationCreate, TeamMemberEducationUpdate, TeamMemberEducationResponse,
    TeamMemberProjectCreate, TeamMemberProjectUpdate, TeamMemberProjectResponse,
    TeamMemberCertificationCreate, TeamMemberCertificationUpdate, TeamMemberCertificationResponse,
    OrganizationalProjectResponse,
)

router = APIRouter(prefix="/team", tags=["team"])


def _not_found(name: str = "Team member"):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{name} not found")


async def _load_detail(member: TeamMember, db: DB) -> TeamMemberDetailResponse:
    exp_res = await db.execute(
        select(TeamMemberExperience)
        .where(TeamMemberExperience.team_member_id == member.id)
        .order_by(TeamMemberExperience.order_index)
    )
    edu_res = await db.execute(
        select(TeamMemberEducation)
        .where(TeamMemberEducation.team_member_id == member.id)
        .order_by(TeamMemberEducation.order_index)
    )
    proj_res = await db.execute(
        select(TeamMemberProject)
        .where(TeamMemberProject.team_member_id == member.id)
        .order_by(TeamMemberProject.order_index)
    )
    cert_res = await db.execute(
        select(TeamMemberCertification)
        .where(TeamMemberCertification.team_member_id == member.id)
        .order_by(TeamMemberCertification.order_index)
    )
    detail = TeamMemberDetailResponse.model_validate(member)
    detail.experiences = [TeamMemberExperienceResponse.model_validate(e) for e in exp_res.scalars()]
    detail.educations = [TeamMemberEducationResponse.model_validate(e) for e in edu_res.scalars()]
    detail.projects = [TeamMemberProjectResponse.model_validate(e) for e in proj_res.scalars()]
    detail.certifications = [TeamMemberCertificationResponse.model_validate(e) for e in cert_res.scalars()]
    return detail


# ── Public endpoints ──────────────────────────────────────────────────────────

@router.get("", response_model=List[TeamMemberResponse])
async def list_team(db: DB):
    result = await db.execute(
        select(TeamMember)
        .where(TeamMember.is_active == True)
        .order_by(TeamMember.display_order, TeamMember.full_name)
    )
    return result.scalars().all()


@router.get("/projects/organizational", response_model=List[OrganizationalProjectResponse])
async def list_organizational_projects(db: DB):
    """Company-wide projects — contributed by any team member but flagged
    is_organizational, not tied to any one person's profile. Powers the
    landing page's Projects section and the public /projects grid."""
    result = await db.execute(
        select(TeamMemberProject, TeamMember)
        .join(TeamMember, TeamMember.id == TeamMemberProject.team_member_id)
        .where(TeamMemberProject.is_organizational == True, TeamMember.is_active == True)
        .order_by(TeamMemberProject.order_index, TeamMemberProject.title)
    )
    projects = []
    for project, member in result.all():
        data = TeamMemberProjectResponse.model_validate(project).model_dump()
        projects.append(OrganizationalProjectResponse(
            **data,
            contributor_name=member.full_name,
            contributor_slug=member.slug,
            contributor_photo_url=member.photo_url,
        ))
    return projects


@router.get("/projects/organizational/{project_id}", response_model=OrganizationalProjectResponse)
async def get_organizational_project(project_id: uuid.UUID, db: DB):
    result = await db.execute(
        select(TeamMemberProject, TeamMember)
        .join(TeamMember, TeamMember.id == TeamMemberProject.team_member_id)
        .where(TeamMemberProject.id == project_id, TeamMemberProject.is_organizational == True, TeamMember.is_active == True)
    )
    row = result.first()
    if not row:
        _not_found("Project")
    project, member = row
    data = TeamMemberProjectResponse.model_validate(project).model_dump()
    return OrganizationalProjectResponse(
        **data,
        contributor_name=member.full_name,
        contributor_slug=member.slug,
        contributor_photo_url=member.photo_url,
    )


@router.get("/{slug}", response_model=TeamMemberDetailResponse)
async def get_team_member(slug: str, db: DB):
    result = await db.execute(select(TeamMember).where(TeamMember.slug == slug, TeamMember.is_active == True))
    member = result.scalar_one_or_none()
    if not member:
        _not_found()
    return await _load_detail(member, db)


# ── Admin endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/all", response_model=List[TeamMemberResponse])
async def admin_list_team(_: PortfolioAdminUser, db: DB):
    result = await db.execute(
        select(TeamMember).order_by(TeamMember.display_order, TeamMember.full_name)
    )
    return result.scalars().all()


@router.post("/admin", response_model=TeamMemberDetailResponse, status_code=201)
async def admin_create_member(payload: TeamMemberCreate, _: PortfolioAdminUser, db: DB):
    existing = await db.execute(select(TeamMember).where(TeamMember.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already taken")
    member = TeamMember(**payload.model_dump())
    db.add(member)
    await db.flush()
    return await _load_detail(member, db)


@router.patch("/admin/{member_id}", response_model=TeamMemberDetailResponse)
async def admin_update_member(member_id: uuid.UUID, payload: TeamMemberUpdate, _: PortfolioAdminUser, db: DB):
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        _not_found()
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(member, k, v)
    await db.flush()
    return await _load_detail(member, db)


@router.delete("/admin/{member_id}", status_code=204)
async def admin_delete_member(member_id: uuid.UUID, _: PortfolioAdminUser, db: DB):
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        _not_found()
    await db.delete(member)


# ── Experience ────────────────────────────────────────────────────────────────

@router.post("/admin/{member_id}/experiences", response_model=TeamMemberExperienceResponse, status_code=201)
async def add_experience(member_id: uuid.UUID, payload: TeamMemberExperienceCreate, _: PortfolioAdminUser, db: DB):
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    if not result.scalar_one_or_none():
        _not_found()
    obj = TeamMemberExperience(team_member_id=member_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/admin/{member_id}/experiences/{exp_id}", response_model=TeamMemberExperienceResponse)
async def update_experience(member_id: uuid.UUID, exp_id: uuid.UUID, payload: TeamMemberExperienceUpdate, _: PortfolioAdminUser, db: DB):
    result = await db.execute(
        select(TeamMemberExperience).where(TeamMemberExperience.id == exp_id, TeamMemberExperience.team_member_id == member_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Experience")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/admin/{member_id}/experiences/{exp_id}", status_code=204)
async def delete_experience(member_id: uuid.UUID, exp_id: uuid.UUID, _: PortfolioAdminUser, db: DB):
    result = await db.execute(
        select(TeamMemberExperience).where(TeamMemberExperience.id == exp_id, TeamMemberExperience.team_member_id == member_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Experience")
    await db.delete(obj)


# ── Education ────────────────────────────────────────────────────────────────

@router.post("/admin/{member_id}/educations", response_model=TeamMemberEducationResponse, status_code=201)
async def add_education(member_id: uuid.UUID, payload: TeamMemberEducationCreate, _: PortfolioAdminUser, db: DB):
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    if not result.scalar_one_or_none():
        _not_found()
    obj = TeamMemberEducation(team_member_id=member_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/admin/{member_id}/educations/{edu_id}", response_model=TeamMemberEducationResponse)
async def update_education(member_id: uuid.UUID, edu_id: uuid.UUID, payload: TeamMemberEducationUpdate, _: PortfolioAdminUser, db: DB):
    result = await db.execute(
        select(TeamMemberEducation).where(TeamMemberEducation.id == edu_id, TeamMemberEducation.team_member_id == member_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Education")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/admin/{member_id}/educations/{edu_id}", status_code=204)
async def delete_education(member_id: uuid.UUID, edu_id: uuid.UUID, _: PortfolioAdminUser, db: DB):
    result = await db.execute(
        select(TeamMemberEducation).where(TeamMemberEducation.id == edu_id, TeamMemberEducation.team_member_id == member_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Education")
    await db.delete(obj)


# ── Projects ──────────────────────────────────────────────────────────────────

@router.post("/admin/{member_id}/projects", response_model=TeamMemberProjectResponse, status_code=201)
async def add_project(member_id: uuid.UUID, payload: TeamMemberProjectCreate, _: PortfolioAdminUser, db: DB):
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    if not result.scalar_one_or_none():
        _not_found()
    obj = TeamMemberProject(team_member_id=member_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/admin/{member_id}/projects/{proj_id}", response_model=TeamMemberProjectResponse)
async def update_project(member_id: uuid.UUID, proj_id: uuid.UUID, payload: TeamMemberProjectUpdate, _: PortfolioAdminUser, db: DB):
    result = await db.execute(
        select(TeamMemberProject).where(TeamMemberProject.id == proj_id, TeamMemberProject.team_member_id == member_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Project")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/admin/{member_id}/projects/{proj_id}", status_code=204)
async def delete_project(member_id: uuid.UUID, proj_id: uuid.UUID, _: PortfolioAdminUser, db: DB):
    result = await db.execute(
        select(TeamMemberProject).where(TeamMemberProject.id == proj_id, TeamMemberProject.team_member_id == member_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Project")
    await db.delete(obj)


# ── Certifications ────────────────────────────────────────────────────────────

@router.post("/admin/{member_id}/certifications", response_model=TeamMemberCertificationResponse, status_code=201)
async def add_certification(member_id: uuid.UUID, payload: TeamMemberCertificationCreate, _: PortfolioAdminUser, db: DB):
    result = await db.execute(select(TeamMember).where(TeamMember.id == member_id))
    if not result.scalar_one_or_none():
        _not_found()
    obj = TeamMemberCertification(team_member_id=member_id, **payload.model_dump())
    db.add(obj)
    await db.flush()
    return obj


@router.patch("/admin/{member_id}/certifications/{cert_id}", response_model=TeamMemberCertificationResponse)
async def update_certification(member_id: uuid.UUID, cert_id: uuid.UUID, payload: TeamMemberCertificationUpdate, _: PortfolioAdminUser, db: DB):
    result = await db.execute(
        select(TeamMemberCertification).where(TeamMemberCertification.id == cert_id, TeamMemberCertification.team_member_id == member_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Certification")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    return obj


@router.delete("/admin/{member_id}/certifications/{cert_id}", status_code=204)
async def delete_certification(member_id: uuid.UUID, cert_id: uuid.UUID, _: PortfolioAdminUser, db: DB):
    result = await db.execute(
        select(TeamMemberCertification).where(TeamMemberCertification.id == cert_id, TeamMemberCertification.team_member_id == member_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Certification")
    await db.delete(obj)
