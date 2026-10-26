# Zamzam Foods — Enterprise Distribution Management System

A production-ready, secure full-stack business management application built with **Django REST Framework** and **React (Vite + TypeScript + PWA)** for **Zamzam Foods**.

The system manages daily production and distribution of **Kubbus** and **Romali** across **3 delivery routes** (Pandikkad, Perundurai, Melattur), servicing approximately **200 customer shops** with deliveries, payment collections (Cash & GPay/UPI), and an immutable **credit ledger**.

---

## 1. System Architecture

```
React (Vite + TypeScript + PWA)
           ↓  (JWT Bearer, JSON REST)
     REST API (/api/v1/)
           ↓  (Role authorization & Driver data isolation)
    Django Service Layer (transaction.atomic(), Decimal arithmetic)
           ↓  (Audit trails & Ledger integrity)
       Django ORM
           ↓  (TLS 1.3 SSL, Connection Pooling, Storage Quota Monitoring)
Cloud Database: Aiven for PostgreSQL (Authoritative Business Database)
```

* **Cloud-First Architecture**: Authoritative cloud database hosted on **Aiven for PostgreSQL Free** (1 GB storage quota). All desktop clients (Windows `.exe` and macOS `.dmg`) synchronize seamlessly in real-time through the secure Django REST API.
* **Backend Authority**: Django enforces all business logic, validation, financial calculations, and data isolation. Frontend never accesses the database directly.
* **Three Dedicated Interfaces**:
  1. **Owner / Admin**: Full business oversight (KPI dashboard, customer directory, pricing, routes, drivers, orders, deliveries, receipts, credit ledger, financial reports, staff roles).
  2. **Manager**: Daily operational control (operations dashboard, order entry, route deliveries tracking, payments, customer receivables monitoring).
  3. **Driver (Mobile-First PWA)**: Designed specifically for delivery drivers on smartphones (route schedule, shop stops, one-touch delivery confirmation, cash & UPI collection, daily tally).

---

## 2. Security & Data Integrity

### Strict Driver Data Isolation & IDOR Protection
* **Queryset & Permission Level Enforcement**: If Driver A (assigned to Pandikkad) attempts to access Driver B's deliveries or orders via URL tampering (e.g., `GET /api/v1/deliveries/<uuid_of_driver_b>/`), the backend returns **404 Not Found** (or 403 Forbidden).
* Drivers can only see customer shops, orders, and deliveries assigned to their user and designated route.

### Money Handling & Financial Precision
* **Zero Floating-Point Representation**: All prices, subtotals, order totals, payments, and credit balances are stored and calculated using Python's `Decimal` and Django's `DecimalField(max_digits=12, decimal_places=2)`.
* **Atomic Transactions**: Orders, delivery completion, payments, and credit transactions are wrapped in `transaction.atomic()` to guarantee all-or-nothing execution without partial financial states.

### Immutable Credit Ledger
* Rather than overwriting a single balance field, every financial movement generates a traceable `CreditTransaction` entry with:
  * `TransactionType`: `OPENING_BALANCE`, `CREDIT_SALE`, `CASH_PAYMENT`, `GPAY_PAYMENT`, `ADJUSTMENT`
  * `amount`: Signed delta (+ increases customer debt, - decreases debt)
  * `balance_after`: Immediate balance snapshot
  * `recorded_by`: Staff member who executed or authorized the transaction

---

## 3. Technology Stack

### Backend
* **Python 3.9+** & **Django 4.2 LTS**
* **Django REST Framework 3.16**
* **SimpleJWT 5.5** (JWT Authentication)
* **django-cors-headers** (Restricted CORS)
* **drf-spectacular** (OpenAPI 3.0 & Swagger UI)
* **SQLite** (Development) / **PostgreSQL** ready (Production)

### Frontend
* **React 19**
* **Vite**
* **TypeScript**
* **React Router DOM 7**
* **Lucide React** (Icons)
* **PWA** (Web App Manifest + Service Worker)

---

## 4. Getting Started

### Prerequisites
* Python 3.9+
* Node.js 18+ & npm

### 1. Backend Setup
```bash
# Activate virtual environment
source .venv/bin/activate

# Install requirements
pip install -r backend/requirements/development.txt

# Apply database migrations
python backend/manage.py migrate

# Seed initial roles, routes, products, shops, and sample orders
python backend/manage.py seed_data

# Run Django development server
python backend/manage.py runserver 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
The React application will be available at `http://localhost:5173`.

---

## 5. Pre-Seeded Demo Accounts

| Role | Username | Password | Notes |
|---|---|---|---|
| **Owner** | `owner` | `admin123` | Complete executive & staff administration |
| **Manager** | `manager` | `manager123` | Daily orders and operational control |
| **Driver 1** | `driver_pkd` | `driver123` | Pandikkad Route (Faisal P - KL-10-AZ-1011) |
| **Driver 2** | `driver_prd` | `driver123` | Perundurai Route (Rashid K - KL-10-BX-2022) |
| **Driver 3** | `driver_mlt` | `driver123` | Melattur Route (Anoop M - KL-10-CY-3033) |

---

## 6. API Documentation

Interactive OpenAPI 3.0 documentation is auto-generated by `drf-spectacular`:
* **Swagger UI**: [http://localhost:8000/api/v1/docs/](http://localhost:8000/api/v1/docs/)
* **ReDoc**: [http://localhost:8000/api/v1/redoc/](http://localhost:8000/api/v1/redoc/)
* **Raw Schema**: [http://localhost:8000/api/v1/schema/](http://localhost:8000/api/v1/schema/)

---

## 7. Automated Test Suite

Run the backend test suite covering authentication, permissions, driver isolation, and ledger arithmetic:
```bash
source .venv/bin/activate
python backend/manage.py test tests
```

Tests include:
* JWT authentication & refresh flow
* Owner vs Manager permission boundaries
* **Driver Data Isolation & IDOR**: Verifies that Driver A attempting to access Driver B's delivery or shop returns 404/403.
* Complete credit ledger lifecycle: Opening balance (+3000) → Delivery credit sale (+1400) → Cash payment (-500) → UPI payment (-300) = ₹3,600 with snapshot balance verification.

---

---

## 9. Desktop Application (Tauri 2 & Rust)

Zamzam Foods provides a native desktop wrapper built with **Tauri 2** (Rust) that embeds the React frontend with zero overhead and full native OS integration:

### Running Desktop in Development:
```bash
cd frontend
npm run desktop
```

### Packaging Production Installers:
```bash
# Windows (.exe NSIS installer)
npm run desktop:build:win

# macOS (.dmg)
npm run desktop:build:mac

# Linux (.deb / .AppImage)
npm run desktop:build:linux
```

---

## 10. Project Documentation & Delivery Artifacts

Comprehensive enterprise engineering and deployment documentation is available in the root directory:

* 📄 **[DATABASE.md](file:///Users/shiyasahmad/Documents/zamzam%20foods/DATABASE.md)** — Cloud PostgreSQL architecture on Aiven, SSL/TLS 1.3 configuration, 1 GB storage quota monitoring, index performance, and migration procedures.
* 💻 **[INSTALLATION.md](file:///Users/shiyasahmad/Documents/zamzam%20foods/INSTALLATION.md)** — Clean Windows (`.exe`) and macOS (`.dmg`) installation guides, environment setup, and zero local PostgreSQL dependency guide.
* 🚀 **[DEPLOYMENT.md](file:///Users/shiyasahmad/Documents/zamzam%20foods/DEPLOYMENT.md)** — Production deployment guide (Docker, Railway, Cloud VPS), Gunicorn configuration, systemd services, and domain setup.
* 🔒 **[SECURITY.md](file:///Users/shiyasahmad/Documents/zamzam%20foods/SECURITY.md)** — Security architecture, JWT token lifecycle, role-based authorization, IDOR driver isolation, Decimal financial precision, and credential sanitization.
* 🧪 **[TESTING.md](file:///Users/shiyasahmad/Documents/zamzam%20foods/TESTING.md)** — Complete test suite coverage, test runner commands, and automated test results matrix.
* 🤝 **[CLIENT_HANDOVER.md](file:///Users/shiyasahmad/Documents/zamzam%20foods/CLIENT_HANDOVER.md)** — Official client delivery report, production acceptance criteria, credential handover instructions, and sign-off checklist.

