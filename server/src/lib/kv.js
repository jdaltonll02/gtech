import Redis from 'ioredis';
import { config } from '../config.js';
import { prisma } from './prisma.js';

let redis;
const redisClient = () => {
  if (!redis) redis = new Redis(config.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 2 });
  return redis;
};

const encode = (value) => JSON.stringify(value);
const decode = (value) => {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
};

export async function get(key) {
  if (config.REDIS_URL) return decode(await redisClient().get(key));
  const rows = await prisma.$queryRaw`SELECT "value" FROM "kv_store" WHERE "key" = ${key} AND ("expires_at" IS NULL OR "expires_at" > NOW()) LIMIT 1`;
  return rows.length ? rows[0].value : null;
}

export async function set(key, value, ttlSeconds = null) {
  if (config.REDIS_URL) {
    const payload = encode(value);
    if (ttlSeconds) await redisClient().set(key, payload, 'EX', ttlSeconds);
    else await redisClient().set(key, payload);
    return;
  }
  const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;
  await prisma.$executeRaw`INSERT INTO "kv_store" ("key", "value", "expires_at") VALUES (${key}, ${encode(value)}::jsonb, ${expiresAt}) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "expires_at" = EXCLUDED."expires_at", "updated_at" = NOW()`;
}

export async function del(key) {
  if (config.REDIS_URL) return redisClient().del(key);
  return prisma.$executeRaw`DELETE FROM "kv_store" WHERE "key" = ${key}`;
}

export async function deletePattern(pattern) {
  if (config.REDIS_URL) {
    let cursor = '0';
    do {
      const [next, keys] = await redisClient().scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redisClient().del(...keys);
    } while (cursor !== '0');
    return;
  }
  const sqlLike = pattern.replaceAll('%', '\\%').replaceAll('_', '\\_').replaceAll('*', '%');
  await prisma.$executeRaw`DELETE FROM "kv_store" WHERE "key" LIKE ${sqlLike} ESCAPE '\\'`;
}

export async function increment(key, ttlSeconds) {
  const current = Number(await get(key) ?? 0) + 1;
  await set(key, current, ttlSeconds);
  return current;
}

export const revokeToken = (jti, ttl) => set(`revoked:${jti}`, true, ttl);
export const isTokenRevoked = async (jti) => Boolean(await get(`revoked:${jti}`));
export const setPasswordChanged = (userId, timestamp, ttl) => set(`pw_changed:${userId}`, timestamp, ttl);
export const issuedBeforePasswordChange = async (userId, issuedAt) => {
  const changedAt = await get(`pw_changed:${userId}`);
  return changedAt != null && Number(issuedAt) < Number(changedAt);
};

// Idempotent: mirrors prisma/migrations/0031_add_kv_store so a fresh database works without a
// manual migration step. Skipped when Redis holds the key-value state.
export async function ensureKvTable() {
  if (config.REDIS_URL) return;
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "kv_store" (
    "key" TEXT PRIMARY KEY,
    "value" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "ix_kv_store_expires_at" ON "kv_store" ("expires_at")');
}

export async function cleanupExpired() {
  if (!config.REDIS_URL) await prisma.$executeRaw`DELETE FROM "kv_store" WHERE "expires_at" <= NOW()`;
}

export async function closeKv() {
  if (redis) await redis.quit();
}
