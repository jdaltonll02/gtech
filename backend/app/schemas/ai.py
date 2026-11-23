import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class ChatRequest(BaseModel):
    message: str
    session_key: Optional[str] = None


class SourceItem(BaseModel):
    title: str
    url: Optional[str] = None
    snippet: str
    source_type: str  # "document" | "web"


class ChatResponse(BaseModel):
    reply: str
    session_key: str
    sources: List[SourceItem] = []


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    sources: Optional[list] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatHistoryResponse(BaseModel):
    session_key: str
    agent_type: str
    messages: List[ChatMessageOut]


class AIDocumentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    scope: str = "chatbot"
    course_id: Optional[uuid.UUID] = None


class AIDocumentResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: Optional[str]
    file_url: str
    file_name: str
    file_size: Optional[int]
    scope: str
    course_id: Optional[uuid.UUID]
    status: str
    chunk_count: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
