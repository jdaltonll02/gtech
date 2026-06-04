import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, EmailStr

from app.api.deps import AdminUser, SupportAdminUser, CurrentUser, DB
from app.models.support import SupportTicket, TicketMessage
from app.models.user import UserRole

router = APIRouter(prefix="/support", tags=["support"])


# ── Schemas (inline for simplicity) ──────────────────────────────────────────

class TicketCreate(BaseModel):
    name: str
    email: EmailStr
    subject: str
    category: str = "general"
    priority: str = "medium"
    message: str


class TicketReply(BaseModel):
    content: str


class StatusUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None


class MessageOut(BaseModel):
    id: uuid.UUID
    author_name: str
    author_email: str
    is_admin_reply: bool
    content: str
    created_at: datetime
    model_config = {"from_attributes": True}


class TicketOut(BaseModel):
    id: uuid.UUID
    ticket_number: str
    name: str
    email: str
    subject: str
    category: str
    priority: str
    status: str
    created_at: datetime
    updated_at: datetime
    messages: List[MessageOut] = []
    model_config = {"from_attributes": True}


class TicketSummary(BaseModel):
    id: uuid.UUID
    ticket_number: str
    name: str
    email: str
    subject: str
    category: str
    priority: str
    status: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    model_config = {"from_attributes": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _next_ticket_number(db) -> str:
    count = await db.scalar(select(func.count(SupportTicket.id))) or 0
    return f"TICK-{(count + 1):05d}"


async def _notify_new_ticket(ticket: SupportTicket, message: str):
    from app.tasks.email_tasks import send_ticket_notification_task
    send_ticket_notification_task.delay(
        ticket_number=ticket.ticket_number,
        subject=ticket.subject,
        name=ticket.name,
        email=ticket.email,
        category=ticket.category,
        message=message,
    )


async def _notify_ticket_reply(ticket: SupportTicket, reply_content: str, is_admin: bool):
    from app.tasks.email_tasks import send_ticket_reply_task
    send_ticket_reply_task.delay(
        ticket_number=ticket.ticket_number,
        subject=ticket.subject,
        recipient_email=ticket.email,
        recipient_name=ticket.name,
        reply_content=reply_content,
        is_admin_reply=is_admin,
    )


# ── Public: create ticket ─────────────────────────────────────────────────────

@router.post("/tickets", response_model=TicketOut, status_code=201)
async def create_ticket(payload: TicketCreate, db: DB):
    ticket_number = await _next_ticket_number(db)
    ticket = SupportTicket(
        ticket_number=ticket_number,
        name=payload.name,
        email=str(payload.email),
        subject=payload.subject,
        category=payload.category,
        priority=payload.priority,
    )
    db.add(ticket)
    await db.flush()

    first_msg = TicketMessage(
        ticket_id=ticket.id,
        author_name=payload.name,
        author_email=str(payload.email),
        is_admin_reply=False,
        content=payload.message,
    )
    db.add(first_msg)
    await db.flush()
    await db.refresh(ticket, ["messages"])

    await _notify_new_ticket(ticket, payload.message)
    return ticket


# ── Auth: user views own tickets ──────────────────────────────────────────────

@router.get("/tickets/my", response_model=List[TicketSummary])
async def my_tickets(db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(SupportTicket)
        .where(SupportTicket.email == current_user.email)
        .order_by(SupportTicket.created_at.desc())
    )
    tickets = result.scalars().all()
    out = []
    for t in tickets:
        count = await db.scalar(select(func.count(TicketMessage.id)).where(TicketMessage.ticket_id == t.id)) or 0
        d = TicketSummary.model_validate(t)
        d.message_count = count
        out.append(d)
    return out


@router.get("/tickets/my/{ticket_id}", response_model=TicketOut)
async def get_my_ticket(ticket_id: uuid.UUID, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages))
        .where(SupportTicket.id == ticket_id, SupportTicket.email == current_user.email)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.post("/tickets/my/{ticket_id}/reply", response_model=TicketOut)
async def reply_to_ticket(ticket_id: uuid.UUID, payload: TicketReply, db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages))
        .where(SupportTicket.id == ticket_id, SupportTicket.email == current_user.email)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == "closed":
        raise HTTPException(status_code=400, detail="This ticket is closed.")

    msg = TicketMessage(
        ticket_id=ticket.id,
        author_id=current_user.id,
        author_name=current_user.full_name,
        author_email=current_user.email,
        is_admin_reply=False,
        content=payload.content,
    )
    db.add(msg)

    if ticket.status == "waiting_for_user":
        ticket.status = "open"

    await db.flush()
    await db.refresh(ticket, ["messages"])
    return ticket


# ── Admin: manage all tickets ─────────────────────────────────────────────────

@router.get("/admin/tickets", response_model=List[TicketSummary])
async def admin_list_tickets(
    db: DB,
    _: SupportAdminUser,
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
):
    q = select(SupportTicket).order_by(SupportTicket.created_at.desc())
    if status:
        q = q.where(SupportTicket.status == status)
    if priority:
        q = q.where(SupportTicket.priority == priority)
    if category:
        q = q.where(SupportTicket.category == category)
    if search:
        q = q.where(
            SupportTicket.subject.ilike(f"%{search}%") |
            SupportTicket.email.ilike(f"%{search}%") |
            SupportTicket.name.ilike(f"%{search}%") |
            SupportTicket.ticket_number.ilike(f"%{search}%")
        )
    result = await db.execute(q.offset(skip).limit(limit))
    tickets = result.scalars().all()
    out = []
    for t in tickets:
        count = await db.scalar(select(func.count(TicketMessage.id)).where(TicketMessage.ticket_id == t.id)) or 0
        d = TicketSummary.model_validate(t)
        d.message_count = count
        out.append(d)
    return out


@router.get("/admin/tickets/{ticket_id}", response_model=TicketOut)
async def admin_get_ticket(ticket_id: uuid.UUID, db: DB, _: SupportAdminUser):
    result = await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages))
        .where(SupportTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.patch("/admin/tickets/{ticket_id}", response_model=TicketOut)
async def admin_update_ticket(ticket_id: uuid.UUID, payload: StatusUpdate, db: DB, _: SupportAdminUser):
    result = await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages))
        .where(SupportTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if payload.status:
        ticket.status = payload.status
    if payload.priority:
        ticket.priority = payload.priority
    await db.flush()
    return ticket


@router.post("/admin/tickets/{ticket_id}/reply", response_model=TicketOut)
async def admin_reply(ticket_id: uuid.UUID, payload: TicketReply, db: DB, current_user: SupportAdminUser):
    result = await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages))
        .where(SupportTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    msg = TicketMessage(
        ticket_id=ticket.id,
        author_id=current_user.id,
        author_name=current_user.full_name,
        author_email=current_user.email,
        is_admin_reply=True,
        content=payload.content,
    )
    db.add(msg)
    ticket.status = "waiting_for_user"
    await db.flush()
    await db.refresh(ticket, ["messages"])

    await _notify_ticket_reply(ticket, payload.content, is_admin=True)
    return ticket


@router.get("/admin/stats")
async def admin_stats(db: DB, _: SupportAdminUser):
    total = await db.scalar(select(func.count(SupportTicket.id))) or 0
    open_ = await db.scalar(select(func.count(SupportTicket.id)).where(SupportTicket.status == "open")) or 0
    in_progress = await db.scalar(select(func.count(SupportTicket.id)).where(SupportTicket.status == "in_progress")) or 0
    waiting = await db.scalar(select(func.count(SupportTicket.id)).where(SupportTicket.status == "waiting_for_user")) or 0
    resolved = await db.scalar(select(func.count(SupportTicket.id)).where(SupportTicket.status == "resolved")) or 0
    urgent = await db.scalar(select(func.count(SupportTicket.id)).where(SupportTicket.priority == "urgent", SupportTicket.status.notin_(["resolved", "closed"]))) or 0
    return {"total": total, "open": open_, "in_progress": in_progress, "waiting_for_user": waiting, "resolved": resolved, "urgent_open": urgent}
