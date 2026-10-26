# Zamzam Foods — Desktop Installation & Live Aiven Cloud Database Guide

## Architecture: Zero Local DB Setup (Pure Live Cloud Connection)
Zamzam Foods operates as a **Real-Time Cloud Desktop Application** across all operating systems:
- **Windows (`.exe` / NSIS Setup)**
- **macOS (`.dmg`)**

Both platforms connect directly to the authoritative **Aiven PostgreSQL Free Cloud Database**.

### Live Database Configuration
- **Host**: `pg-65e4170-zamzamfoods.h.aivencloud.com`
- **Port**: `18638`
- **Database**: `defaultdb`
- **User**: `avnadmin`
- **Password**: `<YOUR_AIVEN_PASSWORD>`
- **SSL Mode**: `require` (TLS 1.3)
- **Service URI**: `postgres://avnadmin:<YOUR_AIVEN_PASSWORD>@pg-65e4170-zamzamfoods.h.aivencloud.com:18638/defaultdb?sslmode=require`

---

## Key Benefits
1. **Zero Local Database Installation**: No need to install PostgreSQL or configure background database services on Windows or macOS.
2. **Instant Multi-Terminal Sync**: Every cashier, billing desk, and manager installation connects to this single live database in real time.
3. **Identical Data Everywhere**: Any new bill created on Windows immediately appears on macOS and other terminals without manual syncing.
