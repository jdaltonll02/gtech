"""PDF ingestion pipeline: parse → chunk → embed → store."""
import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

CHUNK_SIZE = 600       # characters per chunk
CHUNK_OVERLAP = 80     # character overlap between chunks


def _extract_text_from_pdf(file_bytes: bytes) -> list[dict]:
    """Return list of {page_number, text} dicts."""
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                pages.append({"page_number": i, "text": text})
        return pages
    except Exception as e:
        logger.warning("PDF extraction failed: %s", e)
        return []


def _chunk_text(text: str, page_number: Optional[int] = None) -> list[dict]:
    """Split text into overlapping fixed-size chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + CHUNK_SIZE
        chunk_text = text[start:end].strip()
        if chunk_text:
            chunks.append({
                "content": chunk_text,
                "page_number": page_number,
            })
        start += CHUNK_SIZE - CHUNK_OVERLAP
        if start >= len(text):
            break
    return chunks


async def ingest_document(document_id, file_bytes: bytes, db) -> int:
    """Full ingestion pipeline. Returns number of chunks created."""
    from app.models.ai import AIDocumentChunk, AIDocument, DocumentStatus
    from app.services.llm import get_embedding
    from sqlalchemy import select, update

    pages = _extract_text_from_pdf(file_bytes)
    if not pages:
        await db.execute(
            update(AIDocument)
            .where(AIDocument.id == document_id)
            .values(status=DocumentStatus.error, error_message="Could not extract text from PDF.")
        )
        await db.flush()
        return 0

    all_chunks = []
    for page in pages:
        all_chunks.extend(_chunk_text(page["text"], page["page_number"]))

    chunk_index = 0
    for chunk in all_chunks:
        embedding = await get_embedding(chunk["content"])
        db_chunk = AIDocumentChunk(
            document_id=document_id,
            chunk_index=chunk_index,
            content=chunk["content"],
            embedding=embedding,
            page_number=chunk["page_number"],
            token_count=len(chunk["content"].split()),
        )
        db.add(db_chunk)
        chunk_index += 1

    # Update document status
    await db.execute(
        update(AIDocument)
        .where(AIDocument.id == document_id)
        .values(status=DocumentStatus.ready, chunk_count=chunk_index)
    )
    await db.flush()
    return chunk_index
