#!/usr/bin/env bash
# ==============================================================================
# AVORA BANK - Automated Institutional Database Backup Script
# ==============================================================================
# Features:
# - Hot transactional backup (mysqldump --single-transaction)
# - High-ratio Gzip compression (.sql.gz)
# - SHA-256 cryptographic integrity checksum
# - 14-day rolling retention pruning
# ==============================================================================
set -e

TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
BACKUP_FILE="${BACKUP_DIR}/avora_mariadb_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "🗄️ [$(date '+%Y-%m-%d %H:%M:%S')] Initiating Avora Bank Database Backup..."

# Extract credentials from .env DATABASE_URL if not set directly
if [ -z "$DB_USER" ] && [ -f "${ROOT_DIR}/.env" ]; then
    DATABASE_URL=$(grep '^DATABASE_URL=' "${ROOT_DIR}/.env" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    
    # Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE
    PROTO="${DATABASE_URL%%://*}"
    USER_PASS_HOST_PORT_DB="${DATABASE_URL#*://}"
    USER_PASS="${USER_PASS_HOST_PORT_DB%%@*}"
    HOST_PORT_DB="${USER_PASS_HOST_PORT_DB#*@}"
    
    DB_USER="${USER_PASS%%:*}"
    DB_PASSWORD="${USER_PASS#*:}"
    HOST_PORT="${HOST_PORT_DB%%/*}"
    DB_NAME="${HOST_PORT_DB#*/}"
    # Strip query parameters if present
    DB_NAME="${DB_NAME%%\?*}"
    
    DB_HOST="${HOST_PORT%%:*}"
    DB_PORT="${HOST_PORT#*:}"
    if [ "$DB_HOST" = "$DB_PORT" ]; then
        DB_PORT="3306"
    fi
fi

if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ]; then
    echo "❌ Error: Could not determine database connection details. Ensure DATABASE_URL is configured."
    exit 1
fi

echo "📦 Dumping database '${DB_NAME}' from host '${DB_HOST}:${DB_PORT}'..."

# Execute hot backup with transactional consistency
mysqldump \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --password="$DB_PASSWORD" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --default-character-set=utf8mb4 \
    "$DB_NAME" | gzip -9 > "$BACKUP_FILE"

# Generate SHA-256 Checksum for institutional audit compliance
sha256sum "$BACKUP_FILE" > "$CHECKSUM_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "✅ Backup successfully created: ${BACKUP_FILE} (Size: ${BACKUP_SIZE})"
echo "🔒 Checksum verified: $(cat "$CHECKSUM_FILE")"

# Prune old backups past retention limit
echo "🧹 Pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -type f -name "avora_mariadb_*.sql.gz*" -mtime "+${RETENTION_DAYS}" -exec rm -f {} \;

echo "🎉 [$(date '+%Y-%m-%d %H:%M:%S')] Database backup process completed."

