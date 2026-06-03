import uuid
from typing import List
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from app.api.deps import AdminUser, DB
from app.db.redis import cache_delete_pattern, cache_get, cache_set
from app.models.portfolio import Certification, Education, Experience, ProfileSettings, Project, Publication, Skill
from app.schemas.portfolio import (
    CertificationCreate, CertificationResponse, CertificationUpdate,
    EducationCreate, EducationResponse, EducationUpdate,
    ExperienceCreate, ExperienceResponse, ExperienceUpdate,
    ProfileSettingsResponse, ProfileSettingsUpdate,
    ProjectCreate, ProjectResponse, ProjectUpdate,
    PublicationCreate, PublicationResponse, PublicationUpdate,
    SkillCreate, SkillResponse, SkillUpdate,
)

router = APIRouter(prefix="/portfolio", tags=["portfolio"])

# ── Generic helpers ───────────────────────────────────────────────────────────

def _not_found(name: str):
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{name} not found")


def _apply_update(obj, data: dict):
    for k, v in data.items():
        if v is not None:
            setattr(obj, k, v)


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(db: DB):
    cached = await cache_get("projects:all")
    if cached:
        return cached
    result = await db.execute(select(Project).order_by(Project.order_index))
    data = [ProjectResponse.model_validate(r).model_dump(mode="json") for r in result.scalars()]
    await cache_set("projects:all", data, ttl=300)
    return data


@router.post("/projects", response_model=ProjectResponse, status_code=201, dependencies=[])
async def create_project(payload: ProjectCreate, db: DB, _: AdminUser):
    obj = Project(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await cache_delete_pattern("projects:*")
    return obj


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: uuid.UUID, db: DB):
    result = await db.execute(select(Project).where(Project.id == project_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Project")
    return obj


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: uuid.UUID, payload: ProjectUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(Project).where(Project.id == project_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Project")
    _apply_update(obj, payload.model_dump(exclude_unset=True))
    await db.flush()
    await cache_delete_pattern("projects:*")
    return obj


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Project).where(Project.id == project_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Project")
    await db.delete(obj)
    await cache_delete_pattern("projects:*")


# ── Experience ────────────────────────────────────────────────────────────────

@router.get("/experience", response_model=List[ExperienceResponse])
async def list_experience(db: DB):
    cached = await cache_get("experience:all")
    if cached:
        return cached
    result = await db.execute(select(Experience).order_by(Experience.order_index))
    data = [ExperienceResponse.model_validate(r).model_dump(mode="json") for r in result.scalars()]
    await cache_set("experience:all", data, ttl=300)
    return data


@router.post("/experience", response_model=ExperienceResponse, status_code=201)
async def create_experience(payload: ExperienceCreate, db: DB, _: AdminUser):
    obj = Experience(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await cache_delete_pattern("experience:*")
    return obj


@router.get("/experience/{exp_id}", response_model=ExperienceResponse)
async def get_experience(exp_id: uuid.UUID, db: DB):
    result = await db.execute(select(Experience).where(Experience.id == exp_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Experience")
    return obj


@router.patch("/experience/{exp_id}", response_model=ExperienceResponse)
async def update_experience(exp_id: uuid.UUID, payload: ExperienceUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(Experience).where(Experience.id == exp_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Experience")
    _apply_update(obj, payload.model_dump(exclude_unset=True))
    await db.flush()
    await cache_delete_pattern("experience:*")
    return obj


@router.delete("/experience/{exp_id}", status_code=204)
async def delete_experience(exp_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Experience).where(Experience.id == exp_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Experience")
    await db.delete(obj)
    await cache_delete_pattern("experience:*")


# ── Education ─────────────────────────────────────────────────────────────────

@router.get("/education", response_model=List[EducationResponse])
async def list_education(db: DB):
    cached = await cache_get("education:all")
    if cached:
        return cached
    result = await db.execute(select(Education).order_by(Education.order_index))
    data = [EducationResponse.model_validate(r).model_dump(mode="json") for r in result.scalars()]
    await cache_set("education:all", data, ttl=300)
    return data


@router.post("/education", response_model=EducationResponse, status_code=201)
async def create_education(payload: EducationCreate, db: DB, _: AdminUser):
    obj = Education(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await cache_delete_pattern("education:*")
    return obj


@router.get("/education/{edu_id}", response_model=EducationResponse)
async def get_education(edu_id: uuid.UUID, db: DB):
    result = await db.execute(select(Education).where(Education.id == edu_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Education")
    return obj


@router.patch("/education/{edu_id}", response_model=EducationResponse)
async def update_education(edu_id: uuid.UUID, payload: EducationUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(Education).where(Education.id == edu_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Education")
    _apply_update(obj, payload.model_dump(exclude_unset=True))
    await db.flush()
    await cache_delete_pattern("education:*")
    return obj


@router.delete("/education/{edu_id}", status_code=204)
async def delete_education(edu_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Education).where(Education.id == edu_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Education")
    await db.delete(obj)
    await cache_delete_pattern("education:*")


# ── Certifications ────────────────────────────────────────────────────────────

@router.get("/certifications", response_model=List[CertificationResponse])
async def list_certifications(db: DB):
    cached = await cache_get("certifications:all")
    if cached:
        return cached
    result = await db.execute(select(Certification).order_by(Certification.order_index))
    data = [CertificationResponse.model_validate(r).model_dump(mode="json") for r in result.scalars()]
    await cache_set("certifications:all", data, ttl=300)
    return data


@router.post("/certifications", response_model=CertificationResponse, status_code=201)
async def create_certification(payload: CertificationCreate, db: DB, _: AdminUser):
    obj = Certification(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await cache_delete_pattern("certifications:*")
    return obj


@router.get("/certifications/{cert_id}", response_model=CertificationResponse)
async def get_certification(cert_id: uuid.UUID, db: DB):
    result = await db.execute(select(Certification).where(Certification.id == cert_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Certification")
    return obj


@router.patch("/certifications/{cert_id}", response_model=CertificationResponse)
async def update_certification(cert_id: uuid.UUID, payload: CertificationUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(Certification).where(Certification.id == cert_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Certification")
    _apply_update(obj, payload.model_dump(exclude_unset=True))
    await db.flush()
    await cache_delete_pattern("certifications:*")
    return obj


@router.delete("/certifications/{cert_id}", status_code=204)
async def delete_certification(cert_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Certification).where(Certification.id == cert_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Certification")
    await db.delete(obj)
    await cache_delete_pattern("certifications:*")


# ── Publications ──────────────────────────────────────────────────────────────

@router.get("/publications", response_model=List[PublicationResponse])
async def list_publications(db: DB):
    cached = await cache_get("publications:all")
    if cached:
        return cached
    result = await db.execute(select(Publication).order_by(Publication.order_index))
    data = [PublicationResponse.model_validate(r).model_dump(mode="json") for r in result.scalars()]
    await cache_set("publications:all", data, ttl=300)
    return data


@router.post("/publications", response_model=PublicationResponse, status_code=201)
async def create_publication(payload: PublicationCreate, db: DB, _: AdminUser):
    obj = Publication(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await cache_delete_pattern("publications:*")
    return obj


@router.get("/publications/{pub_id}", response_model=PublicationResponse)
async def get_publication(pub_id: uuid.UUID, db: DB):
    result = await db.execute(select(Publication).where(Publication.id == pub_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Publication")
    return obj


@router.patch("/publications/{pub_id}", response_model=PublicationResponse)
async def update_publication(pub_id: uuid.UUID, payload: PublicationUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(Publication).where(Publication.id == pub_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Publication")
    _apply_update(obj, payload.model_dump(exclude_unset=True))
    await db.flush()
    await cache_delete_pattern("publications:*")
    return obj


@router.delete("/publications/{pub_id}", status_code=204)
async def delete_publication(pub_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Publication).where(Publication.id == pub_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Publication")
    await db.delete(obj)
    await cache_delete_pattern("publications:*")


# ── Skills ────────────────────────────────────────────────────────────────────────

@router.get("/skills", response_model=List[SkillResponse])
async def list_skills(db: DB):
    cached = await cache_get("skills:all")
    if cached:
        return cached
    result = await db.execute(select(Skill).order_by(Skill.category, Skill.order_index))
    data = [SkillResponse.model_validate(r).model_dump(mode="json") for r in result.scalars()]
    await cache_set("skills:all", data, ttl=600)
    return data


@router.post("/skills", response_model=SkillResponse, status_code=201)
async def create_skill(payload: SkillCreate, db: DB, _: AdminUser):
    obj = Skill(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await cache_delete_pattern("skills:*")
    return obj


@router.patch("/skills/{skill_id}", response_model=SkillResponse)
async def update_skill(skill_id: uuid.UUID, payload: SkillUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Skill")
    _apply_update(obj, payload.model_dump(exclude_unset=True))
    await db.flush()
    await cache_delete_pattern("skills:*")
    return obj


@router.delete("/skills/{skill_id}", status_code=204)
async def delete_skill(skill_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(Skill).where(Skill.id == skill_id))
    obj = result.scalar_one_or_none()
    if not obj:
        _not_found("Skill")
    await db.delete(obj)
    await cache_delete_pattern("skills:*")


# ── Profile Settings (singleton) ──────────────────────────────────────────────

_PROFILE_ID = 1


@router.get("/profile", response_model=ProfileSettingsResponse)
async def get_profile(db: DB):
    result = await db.execute(select(ProfileSettings).where(ProfileSettings.id == _PROFILE_ID))
    obj = result.scalar_one_or_none()
    if not obj:
        return ProfileSettingsResponse()
    return obj


@router.patch("/profile", response_model=ProfileSettingsResponse)
async def update_profile(payload: ProfileSettingsUpdate, db: DB, _: AdminUser):
    result = await db.execute(select(ProfileSettings).where(ProfileSettings.id == _PROFILE_ID))
    obj = result.scalar_one_or_none()
    if not obj:
        obj = ProfileSettings(id=_PROFILE_ID)
        db.add(obj)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(obj, k, v)
    await db.flush()
    await cache_delete_pattern("profile:*")
    return obj
