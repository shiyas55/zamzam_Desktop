# Zamzam Foods — Database Backup & Disaster Recovery Strategy

This document details the database backup, verification, and restoration strategies for the Zamzam Foods wholesale distribution platform.

---

## 1. Development Environment (SQLite)

In local and development environments, SQLite is the default database engine located at `backend/db.sqlite3`.

### Automated Safe Online Backup
SQLite database locks can cause file corruption if raw file copying is attempted during an active write transaction. To prevent this, the [`scripts/backup_db.sh`](file:///Users/shiyasahmad/Documents/zamzam%20foods/scripts/backup_db.sh) script uses the native SQLite VACUUM/backup API:

```bash
# Execute safe point-in-time online backup
./scripts/backup_db.sh
```

- **Output Location**: `backups/zamzam_sqlite_YYYYMMDD_HHMMSS.sqlite3.gz`
- **ACID Guarantee**: Uses `sqlite3 db.sqlite3 ".backup '...'"` which safely synchronizes pending transactions without interrupting the running server.
- **Retention**: Backups are never automatically overwritten or deleted.

### Restore Procedure (SQLite)
```bash
# 1. Stop backend server
# 2. Decompress desired backup
gunzip -k backups/zamzam_sqlite_YYYYMMDD_HHMMSS.sqlite3.gz

# 3. Swap database file
cp backups/zamzam_sqlite_YYYYMMDD_HHMMSS.sqlite3 backend/db.sqlite3

# 4. Verify integrity
python backend/manage.py showmigrations
python backend/manage.py test tests
```

---

## 2. Production Environment (PostgreSQL)

In staging and production, the platform runs PostgreSQL managed through standard environment variables (`DATABASE_URL` or `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`).

### Automated Daily Snapshot
Execute with environment credentials loaded:

```bash
# Automated dump via script
export DATABASE_URL="postgresql://zamzam_user:password@localhost:5432/zamzam_prod"
./scripts/backup_db.sh
```

Under the hood, this executes:
```bash
pg_dump -Fc --no-acl --no-owner "${DATABASE_URL}" | gzip > "backups/zamzam_db_pg_$(date +%Y%m%d_%H%M%S).sql.gz"
```

### Automated Cron Job (Production Server)
Set up a daily cron task running every morning at 2:00 AM IST:
```crontab
0 2 * * * cd /var/www/zamzam-foods && ./scripts/backup_db.sh >> /var/log/zamzam_backup.log 2>&1
```

### Restore Procedure (PostgreSQL)
```bash
# 1. Decompress backup file
gunzip -k backups/zamzam_db_pg_YYYYMMDD_HHMMSS.sql.gz

# 2. Restore into clean database
pg_restore --clean --if-exists --no-owner --no-privileges -d "${DATABASE_URL}" backups/zamzam_db_pg_YYYYMMDD_HHMMSS.sql

# 3. Run migrations to ensure latest schema
python backend/manage.py migrate
```

---

## 3. High Availability & WAL Archiving (Production Recommendation)

For zero-data-loss business continuity:
1. **Continuous WAL Archiving**: Enable `archive_mode = on` and `archive_command` targeting an encrypted S3 / Cloud Storage bucket.
2. **Read Replica**: Establish streaming replication for the Owner / Manager reporting dashboards to keep analytical query load separate from primary order write transactions.

---

## 4. Native Desktop Backup Manager (Tauri 2 & Rust)

In addition to server snapshots, the **Zamzam Foods Desktop Application** (Tauri 2) includes an independent local backup daemon written in Rust:

### Features
* **Automated Closing Backup**: Captures a verified database snapshot whenever the store billing / counter application is closed.
* **23:59 Safety Daemon**: Background thread verifies if the daily closing backup was performed; if missing, triggers a safety snapshot at 23:59.
* **Duplicate Prevention**: Tracks daily backup completion (`YYYY-MM-DD`) and prevents redundant daily runs.
* **Native Folder Picker**: Users choose their preferred local backup drive/directory (external HDD, USB, local folder).
* **Safe Retention Policy**: Retains the last 30 successful backups (configurable) and **never deletes existing backups when a new backup fails**.
* **Pre-Save Integrity Verification**: Backups are written to a `.tmp` file and checked for size, SQL transactional headers, and SHA-256 checksums before atomic rename.
* **Zero Credential Exposure**: Database credentials (`DATABASE_URL`) remain securely on the server and are never exposed to the frontend, desktop UI, or client logs.

### Restoring a Native PostgreSQL Desktop Backup (`.sql`):
```bash
# Execute against target PostgreSQL instance:
psql "${DATABASE_URL}" -f "/path/to/backup/zamzam_backup_postgresql_YYYYMMDD_HHMMSS.sql"
```

