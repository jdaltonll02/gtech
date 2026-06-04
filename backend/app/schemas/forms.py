from datetime import datetime
from typing import Any, Optional
from uuid import UUID
from pydantic import BaseModel


class FormFieldCreate(BaseModel):
    label: str
    field_type: str  # short_text | long_text | dropdown | radio | checkbox | file | date | number | email | phone | section_header | url
    options: Optional[list[str]] = None
    is_required: bool = False
    order_index: int = 0
    placeholder: Optional[str] = None
    helper_text: Optional[str] = None


class FormFieldUpdate(BaseModel):
    label: Optional[str] = None
    field_type: Optional[str] = None
    options: Optional[list[str]] = None
    is_required: Optional[bool] = None
    order_index: Optional[int] = None
    placeholder: Optional[str] = None
    helper_text: Optional[str] = None


class FormFieldResponse(BaseModel):
    id: UUID
    form_id: UUID
    label: str
    field_type: str
    options: Optional[list[str]]
    is_required: bool
    order_index: int
    placeholder: Optional[str]
    helper_text: Optional[str]
    model_config = {"from_attributes": True}


class DynamicFormCreate(BaseModel):
    title: str
    slug: str
    description: Optional[str] = None
    category: str = "general"
    is_active: bool = True
    is_published: bool = False
    requires_auth: bool = False
    success_message: Optional[str] = None


class DynamicFormUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    is_published: Optional[bool] = None
    requires_auth: Optional[bool] = None
    success_message: Optional[str] = None


class DynamicFormListResponse(BaseModel):
    id: UUID
    title: str
    slug: str
    description: Optional[str]
    category: str
    is_active: bool
    is_published: bool
    requires_auth: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class DynamicFormDetailResponse(DynamicFormListResponse):
    success_message: Optional[str]
    fields: list[FormFieldResponse] = []


class FormReorderItem(BaseModel):
    id: UUID
    order_index: int


class FormFieldReorder(BaseModel):
    items: list[FormReorderItem]


class FormSubmissionCreate(BaseModel):
    responses: dict[str, Any]
    submitter_name: Optional[str] = None
    submitter_email: Optional[str] = None


class FormSubmissionResponse(BaseModel):
    id: UUID
    form_id: UUID
    user_id: Optional[UUID]
    responses: dict[str, Any]
    submitter_name: Optional[str]
    submitter_email: Optional[str]
    submitted_at: datetime
    model_config = {"from_attributes": True}
