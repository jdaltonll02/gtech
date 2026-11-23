"""AI chatbot and classroom assistant endpoints."""
import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import AdminUser, DB, OptionalUser
from app.models.ai import AIDocument, AIDocumentChunk, ChatSession, ChatMessage, DocumentScope, DocumentStatus, AgentType
from app.models.courses import Course
from app.schemas.ai import (
    ChatRequest, ChatResponse, AIDocumentCreate, AIDocumentResponse, ChatHistoryResponse, ChatMessageOut,
)
from app.services.rag import run_chatbot, run_classroom_assistant
from app.services.ingestion import ingest_document

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai"])


# ── Session helpers ───────────────────────────────────────────────────────────

async def _get_or_create_session(
    session_key: Optional[str],
    agent_type: AgentType,
    db,
    user_id: Optional[uuid.UUID] = None,
    course_id: Optional[uuid.UUID] = None,
) -> ChatSession:
    if session_key:
        result = await db.execute(select(ChatSession).options(selectinload(ChatSession.messages)).where(ChatSession.session_key == session_key))
        session = result.scalar_one_or_none()
        if session:
            session.updated_at = datetime.now(timezone.utc)
            return session

    new_key = session_key or str(uuid.uuid4())
    session = ChatSession(
        session_key=new_key,
        agent_type=agent_type,
        user_id=user_id,
        course_id=course_id,
    )
    db.add(session)
    await db.flush()
    await db.refresh(session, ["messages"])
    return session


def _session_to_llm_history(session: ChatSession) -> list[dict]:
    return [{"role": m.role, "content": m.content} for m in session.messages]


# ── General chatbot ───────────────────────────────────────────────────────────

@router.post("/ai/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, db: DB, current_user: OptionalUser):
    session = await _get_or_create_session(
        payload.session_key,
        AgentType.chatbot,
        db,
        user_id=current_user.id if current_user else None,
    )
    history = _session_to_llm_history(session)

    try:
        reply, sources = await run_chatbot(payload.message, history, db)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Persist messages
    db.add(ChatMessage(session_id=session.id, role="user", content=payload.message))
    db.add(ChatMessage(session_id=session.id, role="assistant", content=reply, sources=sources))
    await db.flush()

    return ChatResponse(reply=reply, session_key=session.session_key, sources=sources)


# ── Classroom assistant ────────────────────────────────────────────────────────

@router.post("/ai/classroom/{course_id}", response_model=ChatResponse)
async def classroom_chat(course_id: uuid.UUID, payload: ChatRequest, db: DB, current_user: OptionalUser):
    # Verify course exists
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    session = await _get_or_create_session(
        payload.session_key,
        AgentType.classroom,
        db,
        user_id=current_user.id if current_user else None,
        course_id=course_id,
    )
    history = _session_to_llm_history(session)

    try:
        reply, sources = await run_classroom_assistant(
            payload.message, history, course_id, course.title, db
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    db.add(ChatMessage(session_id=session.id, role="user", content=payload.message))
    db.add(ChatMessage(session_id=session.id, role="assistant", content=reply, sources=sources))
    await db.flush()

    return ChatResponse(reply=reply, session_key=session.session_key, sources=sources)


# ── Chat history ──────────────────────────────────────────────────────────────

@router.get("/ai/sessions/{session_key}/history", response_model=ChatHistoryResponse)
async def get_history(session_key: str, db: DB):
    result = await db.execute(
        select(ChatSession).options(selectinload(ChatSession.messages)).where(ChatSession.session_key == session_key)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return ChatHistoryResponse(
        session_key=session.session_key,
        agent_type=session.agent_type.value,
        messages=[ChatMessageOut.model_validate(m) for m in session.messages],
    )


# ── Admin: chatbot document management ────────────────────────────────────────

@router.get("/admin/ai/documents", response_model=List[AIDocumentResponse])
async def list_ai_documents(db: DB, _: AdminUser, scope: Optional[str] = None, course_id: Optional[uuid.UUID] = None):
    q = select(AIDocument).order_by(AIDocument.created_at.desc())
    if scope:
        q = q.where(AIDocument.scope == scope)
    if course_id:
        q = q.where(AIDocument.course_id == course_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/admin/ai/documents", response_model=AIDocumentResponse, status_code=201)
async def upload_ai_document(
    background_tasks: BackgroundTasks,
    db: DB,
    current_user: AdminUser,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
    scope: str = Form("chatbot"),
    course_id: Optional[str] = Form(None),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if len(file_bytes) > 50 * 1024 * 1024:  # 50 MB limit
        raise HTTPException(status_code=400, detail="File exceeds 50 MB limit.")

    # Save file to local media storage
    import os
    from pathlib import Path
    backend_root = Path(__file__).resolve().parents[4]
    media_dir = backend_root / "media" / "ai-docs"
    os.makedirs(media_dir, exist_ok=True)
    unique_name = f"{uuid.uuid4()}.pdf"
    with open(str(media_dir / unique_name), "wb") as fh:
        fh.write(file_bytes)
    file_url = f"/media/ai-docs/{unique_name}"

    parsed_course_id = uuid.UUID(course_id) if course_id else None
    doc_scope = DocumentScope.course if scope == "course" else DocumentScope.chatbot

    doc = AIDocument(
        title=title,
        description=description or None,
        file_url=file_url,
        file_name=file.filename,
        file_size=len(file_bytes),
        scope=doc_scope,
        course_id=parsed_course_id,
        uploaded_by_id=current_user.id,
        status=DocumentStatus.processing,
    )
    db.add(doc)
    await db.flush()
    doc_id = doc.id

    # Process in background
    async def _run_ingestion():
        from app.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as bg_db:
            async with bg_db.begin():
                await ingest_document(doc_id, file_bytes, bg_db)

    background_tasks.add_task(_run_ingestion)
    return doc


@router.delete("/admin/ai/documents/{doc_id}", status_code=204)
async def delete_ai_document(doc_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(select(AIDocument).where(AIDocument.id == doc_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.flush()


# ── Instructor: course document management ────────────────────────────────────

@router.get("/courses/{course_id}/ai/documents", response_model=List[AIDocumentResponse])
async def list_course_documents(course_id: uuid.UUID, db: DB):
    result = await db.execute(
        select(AIDocument)
        .where(AIDocument.course_id == course_id, AIDocument.scope == DocumentScope.course, AIDocument.is_active == True)
        .order_by(AIDocument.created_at.desc())
    )
    return result.scalars().all()


@router.post("/courses/{course_id}/ai/documents", response_model=AIDocumentResponse, status_code=201)
async def upload_course_document(
    course_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: DB,
    current_user: AdminUser,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(""),
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    import os
    from pathlib import Path
    backend_root = Path(__file__).resolve().parents[4]
    media_dir = backend_root / "media" / "ai-docs"
    os.makedirs(media_dir, exist_ok=True)
    unique_name = f"{uuid.uuid4()}.pdf"
    with open(str(media_dir / unique_name), "wb") as fh:
        fh.write(file_bytes)
    file_url = f"/media/ai-docs/{unique_name}"

    doc = AIDocument(
        title=title,
        description=description or None,
        file_url=file_url,
        file_name=file.filename,
        file_size=len(file_bytes),
        scope=DocumentScope.course,
        course_id=course_id,
        uploaded_by_id=current_user.id,
        status=DocumentStatus.processing,
    )
    db.add(doc)
    await db.flush()
    doc_id = doc.id

    async def _run_ingestion():
        from app.db.session import AsyncSessionLocal
        async with AsyncSessionLocal() as bg_db:
            async with bg_db.begin():
                await ingest_document(doc_id, file_bytes, bg_db)

    background_tasks.add_task(_run_ingestion)
    return doc


@router.delete("/courses/{course_id}/ai/documents/{doc_id}", status_code=204)
async def delete_course_document(course_id: uuid.UUID, doc_id: uuid.UUID, db: DB, _: AdminUser):
    result = await db.execute(
        select(AIDocument).where(AIDocument.id == doc_id, AIDocument.course_id == course_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.flush()
