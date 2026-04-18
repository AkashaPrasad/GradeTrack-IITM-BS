#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/backups/supabase"
LOG_DIR="$BACKUP_DIR/logs"
ENV_FILE="$BACKUP_DIR/.backup.env"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR" "$LOG_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing backup env file: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${SUPABASE_DB_USER:?Missing SUPABASE_DB_USER}"
: "${SUPABASE_DB_HOST:?Missing SUPABASE_DB_HOST}"
: "${SUPABASE_DB_PORT:?Missing SUPABASE_DB_PORT}"
: "${SUPABASE_DB_NAME:?Missing SUPABASE_DB_NAME}"
: "${SUPABASE_DB_PASSWORD:?Missing SUPABASE_DB_PASSWORD}"

docker run --rm \
  -e "PGPASSWORD=$SUPABASE_DB_PASSWORD" \
  -v "$BACKUP_DIR:/backup" \
  postgres:17 \
  pg_dump \
    --dbname="postgresql://${SUPABASE_DB_USER}@${SUPABASE_DB_HOST}:${SUPABASE_DB_PORT}/${SUPABASE_DB_NAME}?sslmode=${SUPABASE_DB_SSLMODE:-require}" \
    --format=plain \
    --no-owner \
    --no-privileges \
    --file="/backup/$(basename "$BACKUP_FILE")"

echo "Backup written to $BACKUP_FILE"
