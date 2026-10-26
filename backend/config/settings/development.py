"""
Development settings for Zamzam Foods.
Uses Local PostgreSQL — fallback to local SQLite for test suites if PostgreSQL is offline.
"""

import os
import dj_database_url
from .base import *

DEBUG = True

ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]
ALLOWED_HOSTS += ["localhost", "127.0.0.1", "0.0.0.0", ".ts.net", "shiyass-macbook-air.tail4ef336.ts.net", "testserver"]

# ─── Database ─────────────────────────────────────────────────────────────────
DEFAULT_DATABASE_URL = "sqlite:///db.sqlite3"

DATABASE_URL_ENV = os.environ.get("DATABASE_URL", "").strip()

# Check .env in BASE_DIR if environment variable is not set
if not DATABASE_URL_ENV:
    env_file = BASE_DIR / ".env"
    if env_file.exists():
        with open(env_file, "r") as f:
            for line in f:
                if line.startswith("DATABASE_URL="):
                    DATABASE_URL_ENV = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break

if not DATABASE_URL_ENV or any(p in DATABASE_URL_ENV for p in ["[YOUR-PASSWORD]", "<your-", "<password>", "YOUR_PASSWORD"]):
    DATABASE_URL_ENV = DEFAULT_DATABASE_URL

_is_sqlite = DATABASE_URL_ENV.startswith("sqlite")
_is_internal = any(h in DATABASE_URL_ENV for h in ["railway.internal", "localhost", "127.0.0.1"]) or _is_sqlite
_ssl_require = not _is_internal and not _is_sqlite
_parsed_db = dj_database_url.parse(
    DATABASE_URL_ENV,
    conn_max_age=0,
    conn_health_checks=False if _is_sqlite else True,
    ssl_require=_ssl_require,
)
if _is_sqlite:
    _name = _parsed_db.get("NAME", "db.sqlite3")
    if not os.path.isabs(_name):
        clean_name = os.path.basename(_name) if "sqlite" in _name else _name
        _parsed_db["NAME"] = str(BASE_DIR / clean_name)

DATABASES = {
    "default": _parsed_db
}

# CORS settings for development (React dev server on port 5173 & Tailscale)
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
CORS_ALLOWED_ORIGINS += [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "https://shiyass-macbook-air.tail4ef336.ts.net",
    "http://shiyass-macbook-air.tail4ef336.ts.net",
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https?://.*$",
    r"^tauri://.*$",
    r"^app://.*$",
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CSRF_TRUSTED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")
    if origin.strip()
]
CSRF_TRUSTED_ORIGINS += [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "https://shiyass-macbook-air.tail4ef336.ts.net",
    "http://shiyass-macbook-air.tail4ef336.ts.net",
]

# Development logging
LOGGING["handlers"]["console"]["level"] = "DEBUG"
LOGGING["root"]["level"] = "DEBUG"
