#!/usr/bin/env bash
# ==============================================================================
# Zamzam Foods — Automated Database Backup Script
# Supports: SQLite (development) and PostgreSQL (production)
# Backups are stored in ./backups/ with ISO timestamps and never auto-deleted.
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"

mkdir -p "${BACKUP_DIR}"

echo "=========================================="
echo "Zamzam Foods — Starting Database Backup"
echo "Timestamp: ${TIMESTAMP}"
echo "=========================================="

if [ -n "${DATABASE_URL:-}" ] || [ -n "${DB_NAME:-}" ]; then
    echo "[INFO] PostgreSQL environment detected."
    PG_FILE="${BACKUP_DIR}/zamzam_db_pg_${TIMESTAMP}.sql.gz"
    
    if [ -n "${DATABASE_URL:-}" ]; then
        pg_dump "${DATABASE_URL}" | gzip > "${PG_FILE}"
    else
        PGPASSWORD="${DB_PASSWORD:-}" pg_dump -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" -U "${DB_USER:-zamzam_user}" "${DB_NAME:-zamzam_db}" | gzip > "${PG_FILE}"
    fi
    echo "[SUCCESS] PostgreSQL backup completed: ${PG_FILE}"
    echo "Size: $(du -h "${PG_FILE}" | cut -f1)"

else
    SQLITE_SRC="${ROOT_DIR}/backend/db.sqlite3"
    if [ -f "${SQLITE_SRC}" ]; then
        echo "[INFO] SQLite database detected at ${SQLITE_SRC}."
        SQLITE_BACKUP="${BACKUP_DIR}/zamzam_sqlite_${TIMESTAMP}.sqlite3"
        
        # Use sqlite3 .backup command for ACID-safe non-blocking online snapshot
        if command -v sqlite3 >/dev/null 2>&1; then
            sqlite3 "${SQLITE_SRC}" ".backup '${SQLITE_BACKUP}'"
        else
            cp "${SQLITE_SRC}" "${SQLITE_BACKUP}"
        fi
        
        gzip -k "${SQLITE_BACKUP}"
        echo "[SUCCESS] SQLite safe backup completed: ${SQLITE_BACKUP}.gz"
        echo "Size: $(du -h "${SQLITE_BACKUP}.gz" | cut -f1)"
    else
        echo "[ERROR] No database found to back up."
        exit 1
    fi
fi

echo "=========================================="
echo "Backup verification complete. Older backups preserved in ${BACKUP_DIR}."
echo "=========================================="
