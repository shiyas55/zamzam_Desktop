# Zamzam Foods — Production Backend Deployment Guide

## 1. Production Architecture Overview

The backend is built with **Django 4.2 LTS** and **Django REST Framework**, deployed via **Docker** / **Gunicorn** on cloud container infrastructure (e.g., Railway / Koyeb), connected securely over TLS 1.3 to the **Aiven PostgreSQL Free Cloud Database**.

---

## 2. Environment Variables Specification

The production application requires the following environment variables. Store these securely in your cloud hosting provider's secret manager (e.g., Railway Dashboard → Variables).

```ini
# ─── Django Core ──────────────────────────────────────────────────────────────
DJANGO_ENV=production
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=generate-a-64-character-cryptographically-random-string
DJANGO_ALLOWED_HOSTS=zamzamfood.up.railway.app,api.zamzamfoods.com

# ─── Database (Aiven PostgreSQL Free) ─────────────────────────────────────────
DATABASE_URL=postgres://avnadmin:YOUR_AIVEN_PASSWORD@pg-65e4170-zamzamfoods.h.aivencloud.com:18638/defaultdb?sslmode=require

# ─── CORS & CSRF ─────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS=https://zamzamfoods.com,tauri://localhost,http://tauri.localhost
CSRF_TRUSTED_ORIGINS=https://zamzamfoods.com,tauri://localhost,http://tauri.localhost

# ─── JWT Authentication ───────────────────────────────────────────────────────
JWT_SECRET_KEY=generate-a-64-character-cryptographically-random-string
JWT_ACCESS_TOKEN_LIFETIME_MINUTES=15
JWT_REFRESH_TOKEN_LIFETIME_DAYS=30
PERSISTENT_LOGIN_DAYS=3

# ─── Security Cookies & TLS ───────────────────────────────────────────────────
JWT_COOKIE_SECURE=True
JWT_COOKIE_SAMESITE=Lax
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

---

## 3. Docker Deployment

The application includes an optimized production `Dockerfile`:
```bash
# Build production container image
docker build -t zamzam-backend:latest ./backend

# Run production container
docker run -d \
  -p 8000:8000 \
  --env-file backend/.env \
  --name zamzam-api \
  zamzam-backend:latest
```

### Container Startup Lifecycle
Upon starting, `entrypoint.sh`:
1. Executes database connectivity health checks.
2. Runs database migrations (`python manage.py migrate --noinput`).
3. Collects static assets (`python manage.py collectstatic --noinput`).
4. Launches Gunicorn WSGI HTTP server with worker concurrency.

---

## 4. Production Health Checks & Monitoring

- **Health Endpoint**: `GET /api/v1/health/` returns `200 OK` with service status.
- **Database Stats Endpoint**: `GET /api/v1/database/stats/` (Owner-only) returns live capacity and record counts.
