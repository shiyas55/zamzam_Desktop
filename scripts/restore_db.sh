#!/usr/bin/env bash
# ==============================================================================
# Zamzam Foods — Automated Database Restoration & Disaster Recovery Script
# Usage: ./scripts/restore_db.sh <path_to_backup_file>
# Supports: .sqlite3, .sqlite3.gz, .sql, .sql.gz, .json
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${ROOT_DIR}/backups"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file>"
    echo ""
    echo "Available backups in ${BACKUP_DIR}:"
    ls -lh "${BACKUP_DIR}" 2>/dev/null || echo "No backups found."
    exit 1
fi

INPUT_FILE="$1"

if [ ! -f "${INPUT_FILE}" ]; then
    echo "[ERROR] Backup file not found: ${INPUT_FILE}"
    exit 1
fi

echo "=========================================="
echo "Zamzam Foods — Database Disaster Recovery"
echo "Target File: ${INPUT_FILE}"
echo "Timestamp:   ${TIMESTAMP}"
echo "=========================================="

TEMP_DIR=$(mktemp -d)
trap 'rm -rf "${TEMP_DIR}"' EXIT

WORK_FILE="${INPUT_FILE}"

# Decompress if gzipped
if [[ "${INPUT_FILE}" == *.gz ]]; then
    echo "[INFO] Decompressing archive..."
    DECOMPRESSED="${TEMP_DIR}/extracted_backup"
    gzip -dc "${INPUT_FILE}" > "${DECOMPRESSED}"
    WORK_FILE="${DECOMPRESSED}"
fi

# Detect File Type
if [[ "${INPUT_FILE}" == *.sqlite3* ]] || file "${WORK_FILE}" | grep -q "SQLite"; then
    echo "[INFO] SQLite format detected."
    SQLITE_DEST="${ROOT_DIR}/backend/db.sqlite3"

    # Pre-restore safety backup
    if [ -f "${SQLITE_DEST}" ]; then
        SAFETY_BACKUP="${SQLITE_DEST}.pre_restore_${TIMESTAMP}.bak"
        echo "[SAFETY] Creating safety snapshot of existing database at: ${SAFETY_BACKUP}"
        cp "${SQLITE_DEST}" "${SAFETY_BACKUP}"
    fi

    # Verify SQLite integrity
    if command -v sqlite3 >/dev/null 2>&1; then
        echo "[VERIFY] Checking SQLite integrity..."
        INTEGRITY=$(sqlite3 "${WORK_FILE}" "PRAGMA integrity_check;" 2>&1 || true)
        if [ "${INTEGRITY}" != "ok" ]; then
            echo "[ERROR] Backup failed integrity check: ${INTEGRITY}"
            exit 1
        fi
        echo "[VERIFY] Integrity check passed."
    fi

    # Atomically replace database
    cp "${WORK_FILE}" "${SQLITE_DEST}"
    echo "[SUCCESS] Restored SQLite database to ${SQLITE_DEST}"

    # Verify Django connectivity
    VENV_PYTHON="${ROOT_DIR}/.venv/bin/python"
    PYTHON_CMD="python"
    if [ -f "${VENV_PYTHON}" ]; then
        PYTHON_CMD="${VENV_PYTHON}"
    fi

    echo "[VERIFY] Checking Django migrations on restored database..."
    "${PYTHON_CMD}" "${ROOT_DIR}/backend/manage.py" showmigrations > /dev/null 2>&1 && echo "[SUCCESS] Database migrations verified successfully."

elif [[ "${INPUT_FILE}" == *.sql* ]]; then
    echo "[INFO] SQL dump format detected."
    if [ -n "${DATABASE_URL:-}" ]; then
        echo "[INFO] Restoring to PostgreSQL via DATABASE_URL..."
        if command -v pg_restore >/dev/null 2>&1 && pg_restore --list "${WORK_FILE}" >/dev/null 2>&1; then
            pg_restore --clean --if-exists --no-owner --no-privileges -d "${DATABASE_URL}" "${WORK_FILE}"
        else
            psql "${DATABASE_URL}" < "${WORK_FILE}"
        fi
        echo "[SUCCESS] PostgreSQL restore completed."
    else
        echo "[INFO] Restoring SQL dump into local SQLite database..."
        SQLITE_DEST="${ROOT_DIR}/backend/db.sqlite3"
        if [ -f "${SQLITE_DEST}" ]; then
            cp "${SQLITE_DEST}" "${SQLITE_DEST}.pre_restore_${TIMESTAMP}.bak"
        fi
        sqlite3 "${SQLITE_DEST}" < "${WORK_FILE}"
        echo "[SUCCESS] SQL restored into SQLite database."
    fi

elif [[ "${INPUT_FILE}" == *.json* ]]; then
    echo "[INFO] JSON Django fixture format detected."
    VENV_PYTHON="${ROOT_DIR}/.venv/bin/python"
    PYTHON_CMD="python"
    if [ -f "${VENV_PYTHON}" ]; then
        PYTHON_CMD="${VENV_PYTHON}"
    fi
    "${PYTHON_CMD}" "${ROOT_DIR}/backend/manage.py" loaddata "${WORK_FILE}"
    echo "[SUCCESS] JSON fixture loaded successfully."

else
    echo "[ERROR] Unrecognized backup format."
    exit 1
fi

echo "=========================================="
echo "Database restoration completed successfully!"
echo "=========================================="
