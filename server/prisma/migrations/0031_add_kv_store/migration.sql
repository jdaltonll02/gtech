CREATE TABLE IF NOT EXISTS "kv_store" (
    "key" TEXT PRIMARY KEY,
    "value" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "ix_kv_store_expires_at" ON "kv_store" ("expires_at");
