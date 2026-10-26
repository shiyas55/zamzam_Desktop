# Zamzam Foods — Cloud Database Architecture & Operations Manual

## 1. Overview
Zamzam Foods uses a cloud-hosted **Aiven PostgreSQL Free** database as the single, authoritative business database.
All desktop installations (Windows `.exe` and macOS `.dmg`) and web interfaces communicate with this database in real time through the authenticated Django REST API service layer.

---

## 2. Cloud Database Specification

| Parameter | Production Value |
|---|---|
| **Database Engine** | PostgreSQL 18.x (High-Performance Relational Engine) |
| **Provider** | Aiven for PostgreSQL (Free Tier) |
| **Host** | `pg-65e4170-zamzamfoods.h.aivencloud.com` |
| **Port** | `18638` |
| **Database Name** | `defaultdb` |
| **SSL / TLS Mode** | `require` (Enforced TLS 1.3 Encrypted Transit) |
| **Connection Pooling** | PgBouncer / Connection pooler supported (Connection limit: 20) |
| **Storage Quota** | **1.00 GB** (Advertised Free Tier Limit) |
| **Current Live Data** | **2,863 authoritative production records** (128 customers, 244 orders, 426 items, 80 payments, 324 ledger entries, system settings) |

---

## 3. Storage Capacity Monitoring & Free-Plan Thresholds

The database size and table record counts are monitored through the backend endpoint `GET /api/v1/database/stats/` (restricted to Owner / Superuser).

### Monitoring Metrics & Thresholds
- **Current Live Storage Consumption**: Approximately **~8.5 MB** of the 1 GB quota (~0.85% usage).
- **Health Thresholds**:
  - **Healthy (< 80% usage)**: Normal business operations.
  - **Warning (80% - 89% usage)**: In-app administrator alert indicating storage is approaching the plan threshold.
  - **Critical (≥ 90% usage)**: High-priority dashboard banner advising database vacuuming, audit log archiving, or plan scaling.
- **Data Protection Policy**: The system **never** automatically deletes invoices, payments, customer balances, or ledger transactions to free space.

---

## 4. Connection Security & Client Architecture

```
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│     Windows Desktop (EXE)       │      │       macOS Desktop (DMG)       │
└────────────────┬────────────────┘      └────────────────┬────────────────┘
                 │                                        │
                 ▼                                        ▼
    HTTPS / TLS 1.3 (REST API)              HTTPS / TLS 1.3 (REST API)
    JWT Bearer Token Authentication         JWT Bearer Token Authentication
                 │                                        │
                 └───────────────────┬────────────────────┘
                                     ▼
                    ┌─────────────────────────────────┐
                    │     Django REST Backend API     │
                    │   Role Authorization & Auditing │
                    └────────────────┬────────────────┘
                                     │
                     psycopg2 / TLS 1.3 Connection
                     Enforced Atomic Transactions
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │    Aiven Cloud PostgreSQL       │
                    │    (1 GB Single Authority)      │
                    └─────────────────────────────────┘
```

### Security Isolation
- **No Direct Frontend Credentials**: Desktop application binaries (`.exe` and `.dmg`) do **not** bundle or expose direct database administrator credentials.
- **Server-Side Verification**: The Django backend validates all requests, enforces permissions, and maintains atomic database sessions using `transaction.atomic()`.

---

## 5. Schema & Database Migrations

Database migrations are managed strictly through Django's migration engine:
```bash
# View migration status
python manage.py showmigrations

# Apply pending migrations
python manage.py migrate
```

---

## 6. Backup & Disaster Recovery Procedures

### Automated Backup Generation
The system provides on-demand and scheduled snapshot creation in either `.sql` or `.json` formats via `POST /api/v1/database/backup/` with SHA-256 cryptographic checksums.

### Restoring from Backup
```bash
# Direct psql restoration (using server environment variables)
psql "$DATABASE_URL" -f backup_file.sql
```
