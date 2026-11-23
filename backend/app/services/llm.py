"""CMU API Gateway client — OpenAI-compatible."""
from typing import Optional
from app.core.config import settings


def _get_client():
    from openai import AsyncOpenAI
    if not settings.CMU_API_GATEWAY_URL or not settings.CMU_API_KEY:
        raise RuntimeError("CMU_API_GATEWAY_URL and CMU_API_KEY must be configured.")
    return AsyncOpenAI(api_key=settings.CMU_API_KEY, base_url=settings.CMU_API_GATEWAY_URL)


async def chat_completion(
    messages: list[dict],
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 1500,
) -> str:
    client = _get_client()
    full_messages = []
    if system_prompt:
        full_messages.append({"role": "system", "content": system_prompt})
    full_messages.extend(messages)

    response = await client.chat.completions.create(
        model=model or settings.CMU_LLM_MODEL,
        messages=full_messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


async def get_embedding(text: str) -> Optional[list[float]]:
    """Return embedding vector or None if embedding model is not configured."""
    if not settings.CMU_EMBEDDING_MODEL or not settings.CMU_API_GATEWAY_URL:
        return None
    client = _get_client()
    try:
        response = await client.embeddings.create(
            model=settings.CMU_EMBEDDING_MODEL,
            input=text[:8000],  # truncate to stay within token limits
        )
        return response.data[0].embedding
    except Exception:
        return None
