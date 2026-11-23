#!/usr/bin/env bash
# Full-stack backup for migrating this app to another VM (or for disaster recovery).
#
# Produces a single self-contained archive containing:
#   - a pg_dump of the database, in pg_restore custom format (-Fc)
#   - a tar of the media_data Docker volume (uploaded photos/files)
#   - backend/.env and frontend/.env (if present)
#   - manifest.json recording when/where/what git commit this was taken from
#
# The database dump runs through a throwaway postgres:18-alpine container, so
# no PostgreSQL client tools need to be installed on the host. Works against
# Neon or any other Postgres reachable from DATABASE_URL_SYNC.
#
# Usage: scripts/backup.sh [output-dir]     (output-dir defaults to ./backups)
#
# See MIGRATION.md for the full migration procedure this backup is used in.

set -euo pipefail

cd "$(dirname "$0")/.."  # always run from repo root, regardless of caller's cwd

OUT_DIR="${1:-./backups}"
STAMP=$(date +%Y%m%d_%H%M%S)
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$OUT_DIR"

if [ ! -f backend/.env ]; then
  echo "ERROR: backend/.env not found. Run this from the repo root on the source VM." >&2
  exit 1
fi

DB_URL=$(grep -E '^DATABASE_URL_SYNC=' backend/.env | head -1 | cut -d= -f2-)
if [ -z "$DB_URL" ]; then
  echo "ERROR: DATABASE_URL_SYNC not set in backend/.env" >&2
  exit 1
fi

echo "==> Dumping database (custom format, via throwaway postgres:18-alpine container)"
docker run --rm postgres:18-alpine pg_dump --format=custom --no-owner --no-privileges --dbname="$DB_URL" \
  > "$WORK/database.dump"
echo "    $(du -h "$WORK/database.dump" | cut -f1) dumped"

echo "==> Locating the media_data Docker volume"
PROJECT=$(docker compose config --format json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || true)
VOLUME_NAME=""
if [ -n "$PROJECT" ]; then
  VOLUME_NAME=$(docker volume ls \
    --filter "label=com.docker.compose.project=$PROJECT" \
    --filter "label=com.docker.compose.volume=media_data" \
    --format '{{.Name}}' | head -1)
fi
if [ -z "$VOLUME_NAME" ]; then
  # Fall back to the default compose naming convention.
  VOLUME_NAME="${PROJECT:-gtech}_media_data"
fi

if docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  echo "==> Exporting media volume '$VOLUME_NAME'"
  docker run --rm -v "${VOLUME_NAME}:/data:ro" -v "$WORK:/backup" alpine \
    sh -c "cd /data && tar czf /backup/media_data.tar.gz . 2>/dev/null || true"
  echo "    $(du -h "$WORK/media_data.tar.gz" | cut -f1) exported"
else
  echo "WARNING: could not find volume '$VOLUME_NAME' — skipping media backup." >&2
  echo "         Check with: docker volume ls" >&2
fi

echo "==> Copying environment files"
mkdir -p "$WORK/env"
[ -f backend/.env ] && cp backend/.env "$WORK/env/backend.env"
[ -f frontend/.env ] && cp frontend/.env "$WORK/env/frontend.env"

echo "==> Writing manifest"
GIT_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
cat > "$WORK/manifest.json" <<EOF
{
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "git_commit": "$GIT_COMMIT",
  "git_branch": "$GIT_BRANCH",
  "db_dump_format": "pg_dump custom format (-Fc), restore with pg_restore",
  "media_volume_source": "$VOLUME_NAME"
}
EOF

ARCHIVE="$OUT_DIR/gtech-backup-$STAMP.tar.gz"
echo "==> Bundling archive"
tar czf "$ARCHIVE" -C "$WORK" .
chmod 600 "$ARCHIVE"

echo "==> Done: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
echo
echo "This archive contains live secrets (.env) and your full database."
echo "Store it securely and transfer it only over SSH/scp — never email or upload it"
echo "to a third-party service, and never commit it to git."
