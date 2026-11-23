"""RAG orchestration: retrieve from doc store + web, build context, call LLM."""
import math
import uuid
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.models.ai import AIDocumentChunk, AIDocument, DocumentScope, DocumentStatus
from app.services.llm import get_embedding, chat_completion
from app.services.web_search import search_web
from app.core.config import settings

logger = logging.getLogger(__name__)

TOP_K_DOCS = 3
TOP_K_WEB = 3


async def _get_site_facts(db: AsyncSession) -> str:
    """Pull comprehensive site content from the DB so the chatbot can answer
    questions about anything on gibtechs.com without needing web indexing."""
    from sqlalchemy import select
    from app.models.portfolio import ProfileSettings, Experience, Project, Skill, Certification, Publication, Education
    from app.models.courses import Course
    from app.models.ecommerce import Product, Category
    from app.models.blog import BlogPost
    from app.models.partners import Partner, Business

    sections: list[str] = []

    # ── Leadership / Profile ─────────────────────────────────────────────────
    result = await db.execute(select(ProfileSettings).limit(1))
    profile = result.scalar_one_or_none()
    if profile:
        lines = [f"G-Tech CEO & Founder: {profile.full_name}", f"Title: {profile.title}"]
        if profile.subtitle:
            lines.append(f"Specialization: {profile.subtitle}")
        if profile.focus_paragraph_1:
            lines.append(profile.focus_paragraph_1)
        if profile.focus_paragraph_2:
            lines.append(profile.focus_paragraph_2)
        sections.append("## Leadership\n" + "\n".join(lines))

    # ── Experience ───────────────────────────────────────────────────────────
    result = await db.execute(select(Experience).order_by(Experience.created_at.desc()).limit(6))
    exps = result.scalars().all()
    if exps:
        lines = [f"- {e.position} at {e.company} ({e.duration})" + (f", {e.location}" if e.location else "") for e in exps]
        sections.append("## Experience\n" + "\n".join(lines))

    # ── Education ────────────────────────────────────────────────────────────
    result = await db.execute(select(Education).order_by(Education.created_at.desc()).limit(5))
    edus = result.scalars().all()
    if edus:
        lines = [f"- {e.degree} in {e.field_of_study}, {e.institution} ({e.start_year}–{e.end_year or 'present'})" for e in edus]
        sections.append("## Education\n" + "\n".join(lines))

    # ── Skills ───────────────────────────────────────────────────────────────
    result = await db.execute(select(Skill).limit(40))
    skills = result.scalars().all()
    if skills:
        by_cat: dict[str, list[str]] = {}
        for s in skills:
            by_cat.setdefault(s.category or "General", []).append(s.name)
        lines = [f"{cat}: {', '.join(names)}" for cat, names in by_cat.items()]
        sections.append("## Skills\n" + "\n".join(lines))

    # ── Certifications ───────────────────────────────────────────────────────
    result = await db.execute(select(Certification).limit(20))
    certs = result.scalars().all()
    if certs:
        lines = [f"- {c.title} — {c.issuer}" + (f" ({c.date})" if c.date else "") for c in certs]
        sections.append("## Certifications\n" + "\n".join(lines))

    # ── Publications ─────────────────────────────────────────────────────────
    result = await db.execute(select(Publication).limit(20))
    pubs = result.scalars().all()
    if pubs:
        lines = [f"- {p.title} — {p.venue} ({p.year}), Authors: {p.authors}" for p in pubs]
        sections.append("## Publications\n" + "\n".join(lines))

    # ── Projects ─────────────────────────────────────────────────────────────
    result = await db.execute(select(Project).order_by(Project.featured.desc(), Project.order_index).limit(15))
    projects = result.scalars().all()
    if projects:
        lines = [f"- {p.title} [{p.category}]: {p.description[:150]}{'…' if len(p.description) > 150 else ''}" for p in projects]
        sections.append("## Projects / Portfolio Work\n" + "\n".join(lines))

    # ── Courses ──────────────────────────────────────────────────────────────
    result = await db.execute(select(Course).where(Course.is_published == True).limit(20))
    courses = result.scalars().all()
    if courses:
        lines = []
        for c in courses:
            price = "Free" if c.is_free else f"${float(c.price):.2f}"
            desc = (c.short_description or c.description or "")[:120]
            lines.append(f"- {c.title} ({c.level}, {price}): {desc}")
        sections.append("## Courses\n" + "\n".join(lines))

    # ── Products ─────────────────────────────────────────────────────────────
    result = await db.execute(select(Product).where(Product.is_active == True).limit(20))
    products = result.scalars().all()
    if products:
        lines = [f"- {p.name} (${float(p.price):.2f}): {(p.description or '')[:100]}" for p in products]
        sections.append("## Products / Store\n" + "\n".join(lines))

    # ── Blog posts ───────────────────────────────────────────────────────────
    result = await db.execute(select(BlogPost).where(BlogPost.is_published == True).order_by(BlogPost.published_at.desc()).limit(10))
    posts = result.scalars().all()
    if posts:
        lines = [f"- \"{p.title}\" ({p.category or 'General'}): {(p.excerpt or '')[:100]}" for p in posts]
        sections.append("## Blog Posts / News\n" + "\n".join(lines))

    # ── Partners & Businesses ────────────────────────────────────────────────
    result = await db.execute(select(Partner).limit(20))
    partners = result.scalars().all()
    if partners:
        sections.append("## Partners\n" + ", ".join(p.name for p in partners))

    result = await db.execute(select(Business).limit(20))
    businesses = result.scalars().all()
    if businesses:
        sections.append("## Businesses & NGOs\n" + ", ".join(b.name for b in businesses))

    return "\n\n".join(sections)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def _retrieve_from_docs(
    query: str,
    db: AsyncSession,
    scope: DocumentScope,
    course_id: Optional[uuid.UUID] = None,
    top_k: int = TOP_K_DOCS,
) -> list[dict]:
    """Retrieve top-k relevant chunks from the document store."""
    query_embedding = await get_embedding(query)

    # Build base query for active, ready documents in scope
    q = (
        select(AIDocumentChunk, AIDocument.title, AIDocument.file_name)
        .join(AIDocument, AIDocumentChunk.document_id == AIDocument.id)
        .where(
            AIDocument.scope == scope,
            AIDocument.is_active == True,
            AIDocument.status == DocumentStatus.ready,
        )
    )
    if course_id:
        q = q.where(AIDocument.course_id == course_id)

    result = await db.execute(q)
    rows = result.all()

    if not rows:
        return []

    if query_embedding:
        # Vector similarity search (in-memory for now; pgvector extension handles scale)
        scored = []
        for chunk, doc_title, file_name in rows:
            if chunk.embedding:
                score = _cosine_similarity(query_embedding, chunk.embedding)
                scored.append((score, chunk, doc_title, file_name))
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:top_k]
    else:
        # Fallback: keyword match scoring
        query_lower = query.lower()
        scored = []
        for chunk, doc_title, file_name in rows:
            words = set(query_lower.split())
            content_lower = chunk.content.lower()
            score = sum(1 for w in words if w in content_lower)
            scored.append((score, chunk, doc_title, file_name))
        scored.sort(key=lambda x: x[0], reverse=True)
        top = scored[:top_k]

    sources = []
    for score, chunk, doc_title, file_name in top:
        if score > 0 or not query_embedding:
            sources.append({
                "title": doc_title or file_name,
                "url": None,
                "snippet": chunk.content[:300] + ("…" if len(chunk.content) > 300 else ""),
                "full_content": chunk.content,
                "page_number": chunk.page_number,
                "source_type": "document",
            })
    return sources


CHATBOT_SYSTEM = """You are G-Tech's helpful AI assistant on gibtechs.com.

## About G-Tech (Gibson Technologies)
G-Tech is a global technology group advancing STEM education, applied research, tech entrepreneurship, and innovation. It was built on the conviction that technology, paired with rigorous education and entrepreneurial intent, is the most reliable engine for sustainable development.

G-Tech's ecosystem spans:
- Accredited learning programs and STEM courses
- Product ventures and a technology store
- Consulting engagements
- Research partnerships across academia, industry, and government

## Mission & Focus Areas
1. **Tech Entrepreneurship** — G-Tech incubates ideas, builds products, and partners with entrepreneurs to create tech-driven businesses with measurable real-world impact.
2. **STEM Education & Research** — Rigorous courses, research collaborations, and learning tools designed to develop technically capable, innovation-ready talent globally.
3. **Innovation & Partnerships** — G-Tech partners with tech companies, academic institutions, and NGOs to co-develop solutions, share resources, and advance shared missions.

## Website Pages
- **Home** (gibtechs.com) — Overview, mission, partners, testimonials
- **Portfolio** (gibtechs.com/portfolio) — CEO profile, projects, experience, skills, publications, certifications
- **Courses** (gibtechs.com/courses) — Full course catalog; enroll and learn online
- **Store** (gibtechs.com/store) — Technology products for purchase
- **Blog** (gibtechs.com/blog) — News, research updates, and articles
- **Gallery** (gibtechs.com/gallery) — Media gallery
- **Contact** (gibtechs.com/contact) — Contact form and information
- **Apply / Forms** (gibtechs.com/forms) — Recruitment, events, and application forms
- **Docs** (gibtechs.com/docs) — Documentation

## How to engage with G-Tech
- To learn: visit /courses and enroll
- To buy tech solutions: visit /store
- To apply or register for events: visit /forms
- To reach the team: visit /contact
- To read articles and news: visit /blog

## Answering guidelines
- Use the context provided (site facts, knowledge base, web results) to answer accurately.
- If specific details aren't in the context, say so and point the user to the right page on the site.
- Be concise, friendly, and helpful.
- Do NOT fabricate names, prices, dates, or details not present in the context.
"""

CLASSROOM_SYSTEM = """You are G-Tech's classroom AI assistant, helping students understand course materials and concepts.

You answer questions using the provided course documents and relevant educational resources.

STRICT RULES:
- You MUST NOT help with quizzes, graded assignments, exams, or homework problems. If a student asks you to answer a quiz question or solve their assignment, politely decline and encourage them to work through it independently.
- You CAN explain concepts, clarify readings, help debug code problems (non-graded), and answer conceptual questions.
- You CAN suggest resources, explain terminology, and walk through example problems (not taken from actual assignments).
- Be encouraging, educational, and clear.
"""


async def run_chatbot(
    message: str,
    history: list[dict],
    db: AsyncSession,
) -> tuple[str, list[dict]]:
    """Run the general chatbot RAG pipeline. Returns (reply, sources)."""
    # 1. Always-available site facts (profile, leadership, experience) from DB
    site_facts = await _get_site_facts(db)

    # 2. Retrieve from document store
    doc_sources = await _retrieve_from_docs(message, db, DocumentScope.chatbot)

    # 3. Web search restricted to the G-Tech site
    site = settings.SITE_URL.replace("https://", "").replace("http://", "").rstrip("/")
    web_results = await search_web(message, site_restrict=site, max_results=TOP_K_WEB)

    # 4. Build context block
    context_parts = []
    if site_facts:
        context_parts.append(f"=== G-Tech Site Facts ===\n{site_facts}")
    if doc_sources:
        context_parts.append("=== Knowledge Base ===")
        for s in doc_sources:
            header = f"[{s['title']}]" + (f" (page {s['page_number']})" if s.get('page_number') else "")
            context_parts.append(f"{header}\n{s['full_content']}")
    if web_results:
        context_parts.append("=== Website Content ===")
        for w in web_results:
            context_parts.append(f"[{w['title']}] {w['url']}\n{w['snippet']}")

    context_block = "\n\n".join(context_parts)

    # 4. Compose messages for LLM
    user_content = message
    if context_block:
        user_content = f"Context:\n{context_block}\n\nQuestion: {message}"

    llm_messages = list(history[-8:])  # last 4 turns
    llm_messages.append({"role": "user", "content": user_content})

    # 5. Call LLM
    reply = await chat_completion(llm_messages, system_prompt=CHATBOT_SYSTEM)

    # 6. Build sources list (deduplicated)
    sources = []
    for s in doc_sources:
        sources.append({"title": s["title"], "url": s.get("url"), "snippet": s["snippet"], "source_type": "document"})
    for w in web_results:
        sources.append({"title": w["title"], "url": w["url"], "snippet": w["snippet"][:200], "source_type": "web"})

    return reply, sources


async def run_classroom_assistant(
    message: str,
    history: list[dict],
    course_id: uuid.UUID,
    course_title: str,
    db: AsyncSession,
) -> tuple[str, list[dict]]:
    """Run the classroom assistant RAG pipeline."""
    # 1. Retrieve from course document store
    doc_sources = await _retrieve_from_docs(message, db, DocumentScope.course, course_id=course_id)

    # 2. Broader web search (no site restriction)
    web_results = await search_web(f"{course_title} {message}", max_results=TOP_K_WEB)

    # 3. Build context
    context_parts = []
    if doc_sources:
        context_parts.append("=== Course Materials ===")
        for s in doc_sources:
            header = f"[{s['title']}]" + (f" (page {s['page_number']})" if s.get('page_number') else "")
            context_parts.append(f"{header}\n{s['full_content']}")
    if web_results:
        context_parts.append("=== External Resources ===")
        for w in web_results:
            context_parts.append(f"[{w['title']}] {w['url']}\n{w['snippet']}")

    context_block = "\n\n".join(context_parts)

    user_content = message
    if context_block:
        user_content = f"Course: {course_title}\n\nContext:\n{context_block}\n\nStudent question: {message}"

    llm_messages = list(history[-8:])
    llm_messages.append({"role": "user", "content": user_content})

    reply = await chat_completion(llm_messages, system_prompt=CLASSROOM_SYSTEM)

    sources = []
    for s in doc_sources:
        sources.append({"title": s["title"], "url": s.get("url"), "snippet": s["snippet"], "source_type": "document"})
    for w in web_results:
        sources.append({"title": w["title"], "url": w["url"], "snippet": w["snippet"][:200], "source_type": "web"})

    return reply, sources
