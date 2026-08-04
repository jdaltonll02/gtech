#!/usr/bin/env bash
# Restore a backup produced by scripts/backup.sh onto a (new) VM.
#
# Usage:
#   scripts/restore.sh <backup-archive.tar.gz> [--skip-db] [--skip-media] [--yes]
#
#   --skip-db     Don't restore the database. Use this when the new VM points
#                 at the SAME Neon database as the source VM (the recommended,
#                 fastest, lowest-risk migration path — see MIGRATION.md
#                 Scenario A). There is nothing to restore in that case; the
#                 data is already there.
#   --skip-media  Don't restore the media_data volume (rarely needed).
#   --yes         Skip the confirmation prompt (for scripted/unattended runs).
#
# Run this from the repo root on the DESTINATION VM, after cloning the repo
# and installing Docker + Compose, and BEFORE the first `docker compose up`.
# It will place backend/.env and frontend/.env, restore the database (unless
# --skip-db), restore the media_data volume, then bring the stack up and wait
# for it to become healthy.
#
# See MIGRATION.md for the full step-by-step migration procedure.

set -euo pipefail

cd "$(dirname "$0")/.."  # always run from repo root

ARCHIVE=""
SKIP_DB=false
SKIP_MEDIA=false
ASSUME_YES=false

for arg in "$@"; do
  case "$arg" in
    --skip-db) SKIP_DB=true ;;
    --skip-media) SKIP_MEDIA=true ;;
    --yes) ASSUME_YES=true ;;
    *) ARCHIVE="$arg" ;;
  esac
done

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Usage: $0 <backup-archive.tar.gz> [--skip-db] [--skip-media] [--yes]" >&2
  exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "==> Extracting archive"
tar xzf "$ARCHIVE" -C "$WORK"

if [ -f "$WORK/manifest.json" ]; then
  echo "==> Backup manifest:"
  python3 -m json.tool "$WORK/manifest.json" | sed 's/^/    /'
else
  echo "WARNING: no manifest.json in this archive — proceeding anyway." >&2
fi

if [ "$ASSUME_YES" != true ]; then
  echo
  echo "This will overwrite backend/.env, frontend/.env, and the media_data volume"
  if [ "$SKIP_DB" != true ]; then
    echo "on THIS machine, and RESTORE (destructively replace) the target database."
  else
    echo "on THIS machine. Database restore is SKIPPED (--skip-db)."
  fi
  read -r -p "Type 'yes' to continue: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "==> Placing environment files"
if [ -f "$WORK/env/backend.env" ]; then
  if [ -f backend/.env ]; then
    cp backend/.env "backend/.env.pre-restore.$(date +%s)"
    echo "    existing backend/.env saved as backend/.env.pre-restore.<timestamp>"
  fi
  cp "$WORK/env/backend.env" backend/.env
fi
if [ -f "$WORK/env/frontend.env" ]; then
  [ -f frontend/.env ] && cp frontend/.env "frontend/.env.pre-restore.$(date +%s)"
  cp "$WORK/env/frontend.env" frontend/.env
fi

if [ "$SKIP_DB" != true ]; then
  if [ ! -f "$WORK/database.dump" ]; then
    echo "ERROR: database.dump not found in archive, but --skip-db was not passed." >&2
    exit 1
  fi
  DB_URL=$(grep -E '^DATABASE_URL_SYNC=' backend/.env | head -1 | cut -d= -f2-)
  if [ -z "$DB_URL" ]; then
    echo "ERROR: DATABASE_URL_SYNC not set in the restored backend/.env" >&2
    exit 1
  fi
  echo "==> Restoring database (this DROPS and recreates objects present in the dump)"
  docker run --rm -v "$WORK/database.dump:/database.dump:ro" postgres:18-alpine \
    pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DB_URL" /database.dump
  echo "    database restored"
else
  echo "==> Skipping database restore (--skip-db)"
fi

if [ "$SKIP_MEDIA" != true ] && [ -f "$WORK/media_data.tar.gz" ]; then
  PROJECT=$(docker compose config --format json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin).get('name',''))" 2>/dev/null || true)
  VOLUME_NAME="${PROJECT:-gtech}_media_data"
  echo "==> Restoring media volume '$VOLUME_NAME'"
  docker volume create "$VOLUME_NAME" >/dev/null
  docker run --rm -v "${VOLUME_NAME}:/data" -v "$WORK:/backup:ro" alpine \
    sh -c "tar xzf /backup/media_data.tar.gz -C /data"
  echo "    media restored"
else
  echo "==> Skipping media restore"
fi

echo "==> Starting the application stack"
docker compose up -d --build

echo "==> Waiting for the API to become healthy..."
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "    API is healthy."
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo "WARNING: API did not report healthy after 60s — check 'docker compose logs api'" >&2
  fi
done

docker compose ps

echo
echo "==> Restore complete. Next steps (see MIGRATION.md):"
echo "    1. Obtain/copy SSL certificates for this host (see MIGRATION.md SSL section)."
echo "    2. Verify the site end-to-end before cutting DNS over."
echo "    3. Update DNS to point at this VM once verified."
