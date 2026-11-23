#!/usr/bin/env bash
# Safe redeploy — rebuilds images WITHOUT touching the media_data volume.
# Run this instead of "docker compose down -v && docker compose up -d"
# The -v flag DELETES volumes (including all uploaded images). Never use it for routine deploys.

set -e

echo "==> Pulling latest changes..."
git pull

echo "==> Building updated images..."
docker compose build

echo "==> Restarting containers (volumes untouched)..."
docker compose up -d

echo "==> Running migrations..."
docker compose exec api alembic upgrade head

echo "==> Done. Checking container health..."
docker compose ps
