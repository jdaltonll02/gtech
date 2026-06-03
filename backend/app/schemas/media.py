from uuid import UUID
from pydantic import BaseModel


class MediaResponse(BaseModel):
    id: UUID
    filename: str
    original_filename: str
    content_type: str
    size_bytes: int
    url: str
    folder: str | None
    model_config = {"from_attributes": True}
