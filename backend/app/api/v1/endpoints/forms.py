import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.api.deps import AdminUser, FormsAdminUser, OptionalUser, DB
from app.models.forms import DynamicForm, FormField, FormSubmission
from app.schemas.forms import (
    DynamicFormCreate, DynamicFormUpdate, DynamicFormListResponse, DynamicFormDetailResponse,
    FormFieldCreate, FormFieldUpdate, FormFieldResponse, FormFieldReorder,
    FormSubmissionCreate, FormSubmissionResponse,
)

router = APIRouter(prefix="/forms", tags=["forms"])


async def _get_form_or_404(form_id: uuid.UUID, db) -> DynamicForm:
    result = await db.execute(
        select(DynamicForm).options(selectinload(DynamicForm.fields)).where(DynamicForm.id == form_id)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


# ── Public ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[DynamicFormListResponse])
async def list_forms(db: DB, category: Optional[str] = None):
    """List all active, published forms."""
    q = select(DynamicForm).where(DynamicForm.is_published == True, DynamicForm.is_active == True)
    if category:
        q = q.where(DynamicForm.category == category)
    q = q.order_by(DynamicForm.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/{slug}", response_model=DynamicFormDetailResponse)
async def get_form(slug: str, db: DB, current_user: OptionalUser):
    result = await db.execute(
        select(DynamicForm)
        .options(selectinload(DynamicForm.fields))
        .where(DynamicForm.slug == slug, DynamicForm.is_published == True, DynamicForm.is_active == True)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if form.requires_auth and not current_user:
        raise HTTPException(status_code=401, detail="Authentication required to view this form.")
    return form


@router.post("/{slug}/submit", status_code=201)
async def submit_form(slug: str, payload: FormSubmissionCreate, db: DB, current_user: OptionalUser):
    result = await db.execute(
        select(DynamicForm)
        .options(selectinload(DynamicForm.fields))
        .where(DynamicForm.slug == slug, DynamicForm.is_published == True, DynamicForm.is_active == True)
    )
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    if form.requires_auth and not current_user:
        raise HTTPException(status_code=401, detail="Authentication required.")

    # Validate required fields
    required_ids = {str(f.id) for f in form.fields if f.is_required and f.field_type != "section_header"}
    missing = [f.label for f in form.fields if f.is_required and f.field_type != "section_header"
               and not payload.responses.get(str(f.id))]
    if missing:
        raise HTTPException(status_code=422, detail=f"Required fields missing: {', '.join(missing)}")

    submission = FormSubmission(
        form_id=form.id,
        user_id=current_user.id if current_user else None,
        responses=payload.responses,
        submitter_name=payload.submitter_name or (current_user.full_name if current_user else None),
        submitter_email=payload.submitter_email or (current_user.email if current_user else None),
    )
    db.add(submission)
    await db.flush()
    return {"message": form.success_message or "Your response has been submitted. Thank you!", "submission_id": str(submission.id)}


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.get("/admin/all", response_model=List[DynamicFormListResponse])
async def admin_list_forms(db: DB, _: FormsAdminUser):
    result = await db.execute(select(DynamicForm).order_by(DynamicForm.created_at.desc()))
    return result.scalars().all()


@router.get("/admin/{form_id}", response_model=DynamicFormDetailResponse)
async def admin_get_form(form_id: uuid.UUID, db: DB, _: FormsAdminUser):
    return await _get_form_or_404(form_id, db)


@router.post("/admin/create", response_model=DynamicFormDetailResponse, status_code=201)
async def create_form(payload: DynamicFormCreate, db: DB, _: FormsAdminUser):
    existing = await db.execute(select(DynamicForm).where(DynamicForm.slug == payload.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A form with this slug already exists.")
    form = DynamicForm(**payload.model_dump())
    db.add(form)
    await db.flush()
    await db.refresh(form, ["fields"])
    return form


@router.patch("/admin/{form_id}", response_model=DynamicFormDetailResponse)
async def update_form(form_id: uuid.UUID, payload: DynamicFormUpdate, db: DB, _: FormsAdminUser):
    form = await _get_form_or_404(form_id, db)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(form, k, v)
    form.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return form


@router.delete("/admin/{form_id}", status_code=204)
async def delete_form(form_id: uuid.UUID, db: DB, _: FormsAdminUser):
    result = await db.execute(select(DynamicForm).where(DynamicForm.id == form_id))
    form = result.scalar_one_or_none()
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    await db.delete(form)
    await db.flush()


# ── Fields ────────────────────────────────────────────────────────────────────

@router.post("/admin/{form_id}/fields", response_model=FormFieldResponse, status_code=201)
async def add_field(form_id: uuid.UUID, payload: FormFieldCreate, db: DB, _: FormsAdminUser):
    form = await _get_form_or_404(form_id, db)
    field = FormField(form_id=form.id, **payload.model_dump())
    db.add(field)
    await db.flush()
    return field


@router.patch("/admin/fields/{field_id}", response_model=FormFieldResponse)
async def update_field(field_id: uuid.UUID, payload: FormFieldUpdate, db: DB, _: FormsAdminUser):
    result = await db.execute(select(FormField).where(FormField.id == field_id))
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(field, k, v)
    await db.flush()
    return field


@router.delete("/admin/fields/{field_id}", status_code=204)
async def delete_field(field_id: uuid.UUID, db: DB, _: FormsAdminUser):
    result = await db.execute(select(FormField).where(FormField.id == field_id))
    field = result.scalar_one_or_none()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    await db.delete(field)
    await db.flush()


@router.post("/admin/{form_id}/fields/reorder", status_code=200)
async def reorder_fields(form_id: uuid.UUID, payload: FormFieldReorder, db: DB, _: FormsAdminUser):
    for item in payload.items:
        result = await db.execute(select(FormField).where(FormField.id == item.id, FormField.form_id == form_id))
        field = result.scalar_one_or_none()
        if field:
            field.order_index = item.order_index
    await db.flush()
    return {"message": "Reordered"}


# ── Submissions ───────────────────────────────────────────────────────────────

@router.get("/admin/{form_id}/submissions", response_model=List[FormSubmissionResponse])
async def list_submissions(form_id: uuid.UUID, db: DB, _: FormsAdminUser, skip: int = 0, limit: int = 100):
    result = await db.execute(
        select(FormSubmission)
        .where(FormSubmission.form_id == form_id)
        .order_by(FormSubmission.submitted_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.delete("/admin/submissions/{submission_id}", status_code=204)
async def delete_submission(submission_id: uuid.UUID, db: DB, _: FormsAdminUser):
    result = await db.execute(select(FormSubmission).where(FormSubmission.id == submission_id))
    sub = result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    await db.delete(sub)
    await db.flush()
