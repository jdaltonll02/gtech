import json
import time
from typing import Any, Optional
import redis.asyncio as aioredis
from app.core.config import settings

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _redis


async def cache_get(key: str) -> Optional[Any]:
    r = await get_redis()
    value = await r.get(key)
    return json.loads(value) if value else None


async def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    r = await get_redis()
    await r.setex(key, ttl, json.dumps(value, default=str))


async def cache_delete(key: str) -> None:
    r = await get_redis()
    await r.delete(key)


async def cache_delete_pattern(pattern: str) -> None:
    r = await get_redis()
    keys = await r.keys(pattern)
    if keys:
        await r.delete(*keys)


# ── Token revocation (logout + password change) ───────────────────────────────

async def revoke_token(jti: str, ttl_seconds: int) -> None:
    """Add a JTI to the blocklist. TTL mirrors the token's remaining lifetime."""
    r = await get_redis()
    await r.setex(f"revoked:{jti}", max(1, ttl_seconds), "1")


async def is_token_revoked(jti: str) -> bool:
    r = await get_redis()
    return bool(await r.exists(f"revoked:{jti}"))


async def set_pw_changed(user_id: str, access_token_ttl_seconds: int) -> None:
    """Record that a user's password changed. Any token issued before now is invalid."""
    r = await get_redis()
    await r.setex(f"pw_changed:{user_id}", access_token_ttl_seconds, str(time.time()))


async def was_issued_before_pw_change(user_id: str, iat: float) -> bool:
    """Return True if the token was issued before the last password change."""
    r = await get_redis()
    val = await r.get(f"pw_changed:{user_id}")
    return bool(val and iat < float(val))
