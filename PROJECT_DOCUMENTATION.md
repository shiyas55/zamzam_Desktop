# Zamzam Foods — Comprehensive Project Technical Documentation

> **Status:** Production Reference & System Architecture Document  
> **Repository:** Zamzam Foods Wholesale Distribution Platform  
> **Target Date / Ledger Baseline:** October 2026 (Live Historical Reconciliation Baseline: Oct 1–Oct 7)  
> **Deployment Target:** Railway (Backend) + Vercel (Web Frontend) + Tauri v2 (Desktop Windows/Mac)  
> **Primary Database:** PostgreSQL 15+ (Production Pooler via Supabase / Railway) / SQLite 3 (Local Dev Fallback)

---

## 1. Project Overview & Technology Stack

### 1.1 Business Domain & Purpose
Zamzam Foods is a commercial food production and wholesale distribution enterprise specializing in fresh bakery flatbreads (**Kubbus** and **Romali**). The business operates a daily distribution network across multiple delivery routes in Kerala (e.g., Pandikkad, Melattur, Wandoor, Manjeri), serving over 150–200 retail partner stores, supermarkets, hotels, and cafeterias.

The software platform manages the end-to-end operational and financial lifecycle:
1. **Daily Wholesale Order Entry**: Rapid keyboard-first order capture for all route shops with shop-specific negotiated prices, discounts, and return/shop expenses.
2. **Delivery Route Dispatch & Van Tracking**: Daily driver assignment, morning truck stock loading, and trip progress tracking.
3. **Credit Ledger & Collections**: Daily Cash and UPI/GPay collections, double-entry customer credit ledgers, and live aging bucket tracking.
4. **Staff Attendance & Wage Accounting**: Daily worker and share partner attendance, tenure-based wage slabs (₹400–₹800/day), cash advances, and salary payouts.
5. **Operational Day Open & Daily Closing**: Cash register float management, daily reconciliation checklists, and manager/owner closing locks.
6. **WhatsApp Communication**: Automated invoice sharing, payment receipts, balance reminders, and Meta Cloud API integration.
7. **Disaster Recovery & Data Integrity**: Multi-layer automated SQL/JSON database backups, transactional restore engines, and Tauri-driven desktop local backups.

---

### 1.2 Technology Stack Matrix

| Layer | Technology | Version | Purpose & Architectural Justification |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | Python | 3.11-slim | High-stability, low-overhead container runtime. |
| **Web Framework** | Django | 4.2.x (LTS) | Enterprise ORM, database migrations, security middleware, and transaction management. |
| **API Framework** | Django REST Framework (DRF) | 3.14+ | Serializers, ViewSets, API filtering, pagination, and unified exception handling. |
| **Authentication** | `djangorestframework-simplejwt` | 5.3+ | Dual HttpOnly Cookie + Bearer JWT token architecture with token blacklisting & session tracking. |
| **Database** | PostgreSQL | 15+ | Relational ACID database with row-level locking (`select_for_update`), JSONB audit logs, and deferred constraints. |
| **Database Adapter** | `psycopg2-binary` + `dj-database-url` | 2.9+ / 3.0+ | Connection pooling (`conn_max_age=600`), SSL verification, and dynamic connection string parsing. |
| **Static & Media** | WhiteNoise + Cloudinary | 6.6+ / 1.40+ | WhiteNoise serves gzipped static bundles; Cloudinary stores customer documents, KYC, and licenses. |
| **API Documentation** | `drf-spectacular` | 0.27+ | OpenAPI 3.0 auto-generation with Swagger UI (`/api/v1/docs/`) and Redoc (`/api/v1/redoc/`). |
| **Frontend Framework** | React | 19.2.x | High-performance component rendering and React Server/Client compatibility. |
| **Language** | TypeScript | 6.0.x / Strict | Strict static type safety across API contracts, financial figures, and domain models. |
| **Build Tool & Bundler** | Vite | 8.3.x | ESM-native HMR development server and optimized rollup production bundling. |
| **Routing** | React Router DOM | 7.18.x | Client-side routing, protected route boundaries, and role-based route segmentation. |
| **Styling** | Vanilla CSS Tokens | Custom (`index.css`) | Zero-runtime CSS custom properties (`--brand-red`, `--brand-yellow`), dark-mode toggling, and hardware-accelerated layouts. |
| **Desktop Engine** | Tauri | 2.10+ (Rust) | Native Windows/macOS desktop application runtime with local filesystem access, auto-backup daemons, and system dialogs. |
| **Hosting (Backend)** | Railway | Cloud Container | Dockerized Gunicorn (3 workers, 120s timeout) deployed from GitHub repository. |
| **Hosting (Frontend)** | Vercel | Edge Network | Single-Page Application (SPA) deployment with rewrites to `index.html`. |

---

## 2. Complete Folder / File Structure & Responsibilities

### 2.1 Workspace Root Structure
```
zamzam foods/
├── backend/                  # Django REST Framework backend application
│   ├── apps/                 # Domain-driven modular Django apps (11 applications)
│   ├── config/               # Project configuration, URLs, ASGI/WSGI, settings
│   ├── Dockerfile            # Production Docker container definition for Railway/Koyeb
│   ├── entrypoint.sh         # Container startup script (migrations, superuser, Gunicorn)
│   ├── manage.py             # Django management entry point
│   ├── requirements.txt      # Production Python dependencies
│   └── .env.example          # Environment configuration template
├── frontend/                 # React 19 + TypeScript + Vite Single Page Application
│   ├── public/               # Public assets, favicon, manifest
│   ├── src/                  # Application source code
│   │   ├── components/       # Reusable UI components & modals
│   │   ├── context/          # React Context providers (Auth, Settings, Theme)
│   │   ├── layouts/          # Role-based shell layouts (Owner, Manager, Driver)
│   │   ├── pages/            # View components grouped by domain & role
│   │   ├── routes/           # AppRoutes and ProtectedRoute guards
│   │   ├── services/         # Axios/Fetch API client and domain service modules
│   │   ├── types/            # TypeScript interfaces and domain type definitions
│   │   ├── utils/            # Formatting, WhatsApp text generation, compression helpers
│   │   ├── App.tsx           # Root component mounting context providers and router
│   │   ├── index.css         # Unified brand design system, variables, dark theme
│   │   └── main.tsx          # React DOM entry point
│   ├── src-tauri/            # Tauri 2 Rust desktop application layer
│   │   ├── src/              # Rust source (backup.rs, lib.rs, main.rs)
│   │   ├── Cargo.toml        # Rust dependencies and metadata
│   │   └── tauri.conf.json   # Tauri window, security, bundle, and plugin configuration
│   ├── package.json          # Node.js dependencies and desktop build scripts
│   └── vite.config.ts        # Vite configuration with proxy and React plugin
├── scripts/                  # Shell maintenance scripts
│   ├── backup_db.sh          # PostgreSQL & SQLite automated snapshot backup script
│   └── restore_db.sh         # Disaster recovery database restoration script
├── backups/                  # Historical snapshot archives
├── BACKUP_STRATEGY.md        # Technical disaster recovery procedures and policies
├── FILE_CLEANUP_DOCUMENTATION.md # Ledger reconciliation and obsolete file register
├── reconciled_clean.sql      # Authoritative production PostgreSQL restore snapshot
├── reconciled_clean.json     # Authoritative production JSON backup snapshot
└── README.md                 # Project operational readme
```

### 2.2 Backend Application Modules (`backend/apps/`)

| Module Path | Primary Responsibility | Key Files |
| :--- | :--- | :--- |
| `apps.accounts` | Custom `User` model with `OWNER`, `MANAGER`, `DRIVER` roles; `DeviceSession` multi-device persistent refresh tokens; `StaffMember`, `StaffAttendance`, `StaffPayout` payroll ledgers. | `models.py`, `views.py`, `urls.py`, `serializers.py` |
| `apps.customers` | Store profile master data (`Customer`), shop credit limits, custom product pricing matrices (`CustomerProductPrice`), shop KYC files (`CustomerDocument`). | `models.py`, `services.py`, `views.py`, `serializers.py` |
| `apps.orders` | Sales orders (`Order`), line items (`OrderItem`), immutable audit trail (`OrderActivityLog`), sequence generator (`ORD-YYYYMMDD-XXXX`), order calculation & credit synchronization. | `models.py`, `services.py`, `views.py`, `serializers.py` |
| `apps.credits` | Immutable double-entry debt ledger (`CreditTransaction`), running customer balance tracking, authorized manager balance adjustments (`ADJUSTMENT`). | `models.py`, `services.py`, `views.py`, `serializers.py` |
| `apps.payments` | Financial receipts (`Payment`), Cash and UPI/GPay collections, payment reversals with mandatory audit reasons, Fast Wholesale Entry payment synchronizer (`sync_daily_payment`). | `models.py`, `services.py`, `views.py`, `serializers.py` |
| `apps.products` | Product catalog (`Product`), SKU identifiers, default selling prices, sequence sorting (`order_number`), fast-entry bypass toggle (`skip_in_entry`). | `models.py`, `views.py`, `serializers.py` |
| `apps.routes` | Delivery territories (`Route`), driver profiles (`Driver`), van operating expenses (`DriverExpense`), daily shift stock tracking (`DriverShift`). | `models.py`, `views.py`, `serializers.py` |
| `apps.deliveries` | Driver dispatch tickets (`Delivery`), order-to-delivery mapping, delivery status (`ASSIGNED`, `IN_TRANSIT`, `DELIVERED`, `NOT_DELIVERED`, `FAILED`). | `models.py`, `services.py`, `views.py`, `serializers.py` |
| `apps.reports` | Central dashboard aggregations, outstanding credit aging buckets, daily collection breakdowns, driver performance analytics, daily business open/close locks (`DailyClosing`). | `models.py`, `views.py`, `urls.py` |
| `apps.common` | `TimeStampedUUIDModel` base model; `ActivityLog` system audit history; `SystemSettings` singleton; database stats, SQL/JSON backup exporter, atomic SQL/JSON restore parser, maintenance mode middleware. | `models.py`, `views.py`, `middleware.py`, `audit.py` |
| `apps.whatsapp` | Meta WhatsApp Cloud API credentials, message templates, webhook receiver for delivery receipts and customer order notifications. | `models.py`, `services.py`, `views.py` |

---

## 3. Pages, Components, Features & User Workflows

### 3.1 Role Architecture & Permission Matrix

The application enforces strict Three-Tier Role-Based Access Control (RBAC):

```
+---------------------------------------------------------------------------------+
|                                 SYSTEM ROLES                                    |
+--------------------------+----------------------------+-------------------------+
|        1. OWNER          |         2. MANAGER         |        3. DRIVER        |
| (Proprietor / Superuser) |   (Billing / Dispatcher)   |    (Delivery Staff)     |
+--------------------------+----------------------------+-------------------------+
| * Full system access     | * Fast wholesale entry     | * Assigned route only   |
| * Business settings & PIN| * Daily closing submission | * View assigned orders  |
| * Reopen closed days     | * View / edit today orders | * Record shop payments  |
| * Delete / clear orders  | * Record staff attendance  | * Log vehicle expenses  |
| * Database backup/restore| * View collections & credit| * Stock load & handover |
| * Staff wage adjustments | * WhatsApp billing & share | * Mobile PWA interface  |
+--------------------------+----------------------------+-------------------------+
```

---

### 3.2 Page & Component Inventory

#### 1. Authentication & Public Views
* `LoginPage.tsx` (`/login`): Clean credential login with role-aware redirection (`/owner`, `/manager`, `/driver`). Handles dual HttpOnly Cookie and LocalStorage Bearer tokens.
* `CustomerOrderPage.tsx` (`/customer/:customerId`): Public customer ordering portal. Retail store owners open their dedicated URL to order Kubbus & Romali directly. Shows previous balance, product prices, order confirmation, and WhatsApp dispatch summary.
* `MaintenanceScreen.tsx`: Intercepts non-owner traffic with an operational maintenance banner when `is_maintenance_mode` is enabled.

#### 2. Manager Views (`/manager/*`)
* `CreateOrderPage.tsx` (`/manager/create-order`): **The operational core of the business.**
  * Multi-column grid containing all active customer shops grouped by delivery route.
  * Columns: Customer Name, Phone/Route, Previous Due (computed rollback), Kubbus Qty, Romali Qty, Other Products, Subtotal, Cash Received, GPay Received, Discount, Net Due, Status, Actions.
  * Rapid Enter-key keyboard navigation (moves cursor seamlessly across product columns and rows).
  * In-place customer creation modal, inline rate modification, instant WhatsApp bill modal.
* `DailyClosingPage.tsx` (`/manager/daily-closing`):
  * **Day Open**: Morning cash float entry (e.g., ₹500.00 cash float) and operational start timestamp.
  * **Day Review**: Live reconciliation of total orders, gross sales, cash collected, UPI collected, driver vehicle expenses, staff cash payouts, and net cash in hand.
  * **Day Closing**: Verification checklist modal and formal lock submission.
* `ManagerDashboard.tsx` (`/manager`): Quick snapshot of today's sales, route completion progress, live collections, and urgent credit alerts.

#### 3. Owner / Administrator Views (`/owner/*`)
* `OwnerDashboard.tsx` (`/owner`): Comprehensive multi-date analytics (Today, Yesterday, This Week, This Month, Custom Date Range) with revenue trends, route collection percentages, and outstanding exposure.
* `OrdersPage.tsx` (`/owner/orders`): Searchable, filterable list of all orders across time. Features status badges, route filters, detailed invoice generation modal (`InvoiceModal`), order editing modal (`EditOrderModal`), and permanent order deletion (Owner only, with automatic credit ledger reversal).
* `CustomerShopsPage.tsx` & `CustomerDetailPage.tsx`: Master store directory. Allows editing contact details, delivery routes, credit limits, custom product pricing rules, transaction ledgers, and KYC document uploads (`CustomerDocument`).
* `CreditLedgerPage.tsx` (`/owner/credit`): Centralized ledger displaying all credit movements. Includes an **Authorize Adjustment** button (`/api/v1/credits/adjust/`) for write-offs or opening balance corrections.
* `ReportsPage.tsx` (`/owner/reports`): 4-in-1 analytical reporting suite:
  1. *Collections Report*: Chronological breakdown of Cash vs UPI receipts with collector identification.
  2. *Outstanding Credit Report*: Aging analysis (0–7 days, 8–15 days, 16–30 days, 30+ days) with one-click WhatsApp payment reminders.
  3. *Driver Collections Report*: Total revenue collected per driver van.
  4. *Daily Financial Summary*: Profit & loss overview (Sales vs Expenses vs Net Margin).
* `StaffUsersPage.tsx` (`/owner/users`): Dual-mode user and staff administration:
  * Tab 1: Staff Profiles, worker designations, tenure wage slab tracking (₹400/₹500/₹600/₹700/₹800), and cash advances / salary payouts (`StaffPayout`).
  * Tab 2: Daily Staff Attendance matrix (`StaffAttendance`) supporting Full Day, Half Day, and Absent/Leave with automatic wage generation.
* `SettingsPage.tsx` (`/owner/settings`):
  * **Security PIN Guard**: Protected by a 4-digit master PIN (Default: `7667`) with admin password reset override.
  * **Company Profile**: Business name, official phone, GSTIN, UPI ID, invoice notes.
  * **Operational Feature Toggles**: WhatsApp Master Switch, Customer Self-Order Switch, Order Discount Switch, Delivery Driver Module Switch, System Maintenance Mode Switch.
  * **Database Backup & Disaster Recovery**: Full database stats, immediate SQL snapshot download, JSON snapshot download, transactional restore file upload, and native desktop backup management.

#### 4. Delivery Driver Mobile Views (`/driver/*` - Mobile PWA)
* `DriverDashboard.tsx`: Mobile route view showing shops in delivery sequence with one-tap status toggling (Delivered, Pending, Failed).
* `DriverCollectPaymentPage.tsx`: Fast payment collection sheet allowing drivers to log Cash or UPI payments on shop delivery.
* `DriverExpensesPage.tsx`: Van fuel, parking, food, and maintenance expense logging.
* `DriverSummaryPage.tsx`: Evening end-of-shift cash reconciliation and handover sheet.

---

## 4. Database Models, Fields, Relationships & Migrations

### 4.1 Schema Relationship Diagram (Mermaid)

```mermaid
erDiagram
    User ||--o{ Order : "creates / enters"
    User ||--o{ Payment : "collects"
    User ||--o{ StaffAttendance : "marks"
    User ||--o{ DeviceSession : "has sessions"
    User ||--o| Driver : "linked driver profile"
    User ||--o| StaffMember : "linked staff profile"

    Route ||--o{ Customer : "contains"
    Route ||--o{ Driver : "assigned to"
    Route ||--o{ Order : "delivers on"

    Customer ||--o{ CustomerProductPrice : "custom pricing"
    Customer ||--o{ CustomerDocument : "KYC documents"
    Customer ||--o{ Order : "places"
    Customer ||--o{ Payment : "makes"
    Customer ||--o{ CreditTransaction : "ledger transactions"

    Product ||--o{ CustomerProductPrice : "custom rate"
    Product ||--o{ OrderItem : "ordered as"

    Order ||--|{ OrderItem : "contains items"
    Order ||--o| Delivery : "assigned delivery"
    Order ||--o{ Payment : "order payments"
    Order ||--o{ CreditTransaction : "credit sale entry"
    Order ||--o{ OrderActivityLog : "lifecycle audit"

    Payment ||--o{ CreditTransaction : "payment credit entry"

    StaffMember ||--o{ StaffAttendance : "daily attendance"
    StaffMember ||--o{ StaffPayout : "wages and advances"
    StaffMember ||--o{ Payment : "physically receives"

    DailyClosing ||--o| User : "closed by / reopened by"
```

---

### 4.2 Comprehensive Model Field Definitions

#### 1. `apps.common.TimeStampedUUIDModel` (Abstract Base)
* `id` (`UUIDField`, Primary Key, default `uuid.uuid4`, non-editable).
* `created_at` (`DateTimeField`, `auto_now_add=True`, indexed).
* `updated_at` (`DateTimeField`, `auto_now=True`).

#### 2. `apps.accounts.User` (Extends `AbstractUser`)
* `role` (`CharField(20)`, choices: `OWNER`, `MANAGER`, `DRIVER`, default `DRIVER`, indexed).
* `phone_number` (`CharField(20)`, blank).
* `updated_at` (`DateTimeField`, `auto_now=True`).

#### 3. `apps.accounts.StaffMember`
* `role_type` (`CharField(20)`, choices: `STAFF` [Driver/Ops], `MEMBER` [Business Share Partner], default `MEMBER`, indexed).
* `user` (`OneToOneField(User)`, nullable, blank, `on_delete=SET_NULL`).
* `full_name` (`CharField(150)`).
* `phone_number` (`CharField(20)`, blank).
* `designation` (`CharField(100)`, default `"Share Member"`).
* `joined_date` (`DateField`, default `timezone.localdate`).
* `wage_type` (`CharField(20)`, choices: `DEFAULT_SLAB`, `CUSTOM`, default `DEFAULT_SLAB`).
* `custom_daily_wage` (`DecimalField(10, 2)`, nullable, blank).
* `proof_document` (`FileField(upload_to="staff_proofs/")`, nullable, blank).
* `is_active` (`BooleanField`, default `True`).

#### 4. `apps.accounts.StaffAttendance`
* `staff` (`ForeignKey(StaffMember)`, `on_delete=CASCADE`, related `attendances`).
* `date` (`DateField`, default `timezone.localdate`, indexed).
* `status` (`CharField(20)`, choices: `FULL` [100%], `HALF` [50%], `LEAVE` [₹0], default `FULL`, indexed).
* `daily_wage` (`DecimalField(10, 2)`, default `0.00`).
* `marked_by` (`ForeignKey(User)`, nullable, `on_delete=SET_NULL`).
* *Constraint*: `unique_together = [("staff", "date")]`.

#### 5. `apps.accounts.StaffPayout`
* `staff` (`ForeignKey(StaffMember)`, `on_delete=CASCADE`, related `payouts`).
* `amount` (`DecimalField(10, 2)`).
* `payout_type` (`CharField(30)`, choices: `SALARY`, `ADVANCE`, `BONUS`, `OTHER`, default `SALARY`).
* `payment_method` (`CharField(20)`, choices: `CASH`, `GPAY_UPI`, default `CASH`).
* `date` (`DateField`, default `timezone.localdate`, indexed).
* `reference` (`CharField(100)`, blank).
* `paid_by` (`ForeignKey(User)`, nullable, `on_delete=SET_NULL`).

#### 6. `apps.customers.Customer`
* `name` (`CharField(150)`, shop name).
* `owner_name` (`CharField(100)`, blank).
* `phone` (`CharField(20)`).
* `alternative_phone` (`CharField(20)`, blank).
* `address` (`TextField`).
* `landmark` (`CharField(100)`, blank).
* `route` (`ForeignKey(Route)`, `on_delete=PROTECT`, related `customers`).
* `credit_limit` (`DecimalField(12, 2)`, default `5000.00`).
* `current_balance` (`DecimalField(12, 2)`, default `0.00`, current receivable due).
* `notes` (`TextField`, blank).
* `is_active` (`BooleanField`, default `True`).

#### 7. `apps.customers.CustomerProductPrice`
* `customer` (`ForeignKey(Customer)`, `on_delete=CASCADE`, related `custom_prices`).
* `product` (`ForeignKey(Product)`, `on_delete=CASCADE`, related `customer_prices`).
* `price` (`DecimalField(12, 2)`).
* `effective_from` (`DateField`, default `timezone.now`).
* `effective_to` (`DateField`, nullable, blank).
* `is_active` (`BooleanField`, default `True`).
* *Constraint*: `UniqueConstraint(fields=["customer", "product"], condition=Q(is_active=True))`.

#### 8. `apps.orders.Order`
* `order_number` (`CharField(30)`, unique, indexed, e.g. `ORD-20261002-0015`).
* `customer` (`ForeignKey(Customer)`, `on_delete=PROTECT`, related `orders`).
* `route` (`ForeignKey(Route)`, `on_delete=PROTECT`, related `orders`).
* `driver` (`ForeignKey(Driver)`, nullable, blank, `on_delete=SET_NULL`).
* `order_date` (`DateField`, default `timezone.now`, indexed).
* `submitted_at` (`DateTimeField`, nullable, blank, indexed).
* `status` (`CharField(20)`, choices: `DRAFT`, `PENDING`, `CONFIRMATION_PENDING`, `CONFIRMED`, `SUBMITTED`, `LOCKED`, `BILLING`, `DELIVERY_CREATED`, `DELIVERED`, `NOT_DELIVERED`, `COMPLETED`, `CANCELLED`, default `DRAFT`, indexed).
* `total_amount` (`DecimalField(12, 2)`, default `0.00`).
* `shop_expense` (`DecimalField(12, 2)`, default `0.00`, deducted return/damage expenses).
* `shop_expense_notes` (`CharField(255)`, blank).
* `source` (`CharField(50)`, default `"MANAGER"`).
* `entered_by_role` (`CharField(50)`, blank).
* `entered_by_name` (`CharField(100)`, blank).
* `created_by` (`ForeignKey(User)`, nullable, `on_delete=SET_NULL`).

#### 9. `apps.orders.OrderItem`
* `order` (`ForeignKey(Order)`, `on_delete=CASCADE`, related `items`).
* `product` (`ForeignKey(Product)`, `on_delete=PROTECT`, related `order_items`).
* `quantity` (`PositiveIntegerField`).
* `unit_price` (`DecimalField(12, 2)`).
* `subtotal` (`DecimalField(12, 2)`).
* *Constraint*: `unique_together = [["order", "product"]]`.

#### 10. `apps.credits.CreditTransaction` (Immutable Ledger)
* `customer` (`ForeignKey(Customer)`, `on_delete=PROTECT`, related `credit_transactions`).
* `transaction_type` (`CharField(30)`, choices: `OPENING_BALANCE`, `CREDIT_SALE`, `CASH_PAYMENT`, `GPAY_PAYMENT`, `ORDER_PAYMENT`, `PREVIOUS_CREDIT_PAYMENT`, `ADJUSTMENT`, `PAYMENT_REVERSAL`, indexed).
* `amount` (`DecimalField(12, 2)`, positive increases receivable, negative decreases receivable).
* `balance_after` (`DecimalField(12, 2)`, customer balance immediately after transaction).
* `reference_order` (`ForeignKey(Order)`, nullable, blank, `on_delete=SET_NULL`).
* `reference_payment` (`ForeignKey(Payment)`, nullable, blank, `on_delete=SET_NULL`).
* `notes` (`TextField`, blank).
* `recorded_by` (`ForeignKey(User)`, nullable, `on_delete=SET_NULL`).

#### 11. `apps.payments.Payment`
* `payment_number` (`CharField(30)`, unique, indexed, e.g. `PAY-20261002-0004`).
* `customer` (`ForeignKey(Customer)`, `on_delete=PROTECT`, related `payments`).
* `order` (`ForeignKey(Order)`, nullable, blank, `on_delete=SET_NULL`).
* `amount` (`DecimalField(12, 2)`).
* `payment_method` (`CharField(20)`, choices: `CASH`, `GPAY_UPI`, default `CASH`, indexed).
* `status` (`CharField(20)`, choices: `COMPLETED`, `REVERSED`, `VOID`, default `COMPLETED`, indexed).
* `reference_number` (`CharField(100)`, blank, UPI Ref/UTR).
* `collected_by` (`ForeignKey(User)`, `on_delete=PROTECT`).
* `staff_member` (`ForeignKey(StaffMember)`, nullable, blank, `on_delete=SET_NULL`).
* `received_at` (`DateTimeField`, default `timezone.now`, indexed).
* `reversed_by` (`ForeignKey(User)`, nullable, blank, `on_delete=SET_NULL`).
* `reversed_at` (`DateTimeField`, nullable, blank).
* `reversal_reason` (`TextField`, blank).

#### 12. `apps.reports.DailyClosing`
* `date` (`DateField`, unique, indexed).
* `is_opened` (`BooleanField`, default `False`).
* `opened_by` (`ForeignKey(User)`, nullable, blank, `on_delete=SET_NULL`).
* `opened_at` (`DateTimeField`, nullable, blank).
* `opening_cash` (`DecimalField(12, 2)`, default `0.00`).
* `is_closed` (`BooleanField`, default `True`).
* `closed_by` (`ForeignKey(User)`, nullable, blank, `on_delete=SET_NULL`).
* `closed_at` (`DateTimeField`, `auto_now_add=True`).
* `reopened_by` (`ForeignKey(User)`, nullable, blank, `on_delete=SET_NULL`).
* `reopen_reason` (`TextField`, blank).
* Snapshot Fields: `total_orders`, `total_sales`, `total_collected`, `cash_collected`, `upi_collected`, `credit_generated`, `previous_credit_collected`, `driver_expenses`, `net_collection`.

---

## 5. Complete API Endpoint Documentation

Base API URL: `https://zamzamfood.up.railway.app/api/v1`

### 5.1 Authentication Endpoints (`apps.accounts`)

#### `POST /auth/login/` (or `/auth/token/`)
Authenticates user, sets HttpOnly JWT cookies, and returns user profile.
* **Request Body**:
  ```json
  {
    "username": "shiyas",
    "password": "SecurePassword123!"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "detail": "Login successful.",
    "user": {
      "id": 1,
      "username": "shiyas",
      "email": "shiyas@zamzamfoods.com",
      "first_name": "Shiyas",
      "last_name": "Ahmad",
      "role": "OWNER",
      "phone_number": "+91 98470 12345",
      "is_active": true
    },
    "access": "eyJhbGciOiJIUzI1NiIsIn...",
    "refresh": "eyJhbGciOiJIUzI1NiIsIn..."
  }
  ```

#### `POST /auth/refresh/`
Refreshes expired access token.
* **Request Body**:
  ```json
  {
    "refresh": "eyJhbGciOiJIUzI1NiIsIn..."
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "access": "eyJhbGciOiJIUzI1NiIsIn...",
    "refresh": "eyJhbGciOiJIUzI1NiIsIn..."
  }
  ```

---

### 5.2 Order Operations (`apps.orders`)

#### `GET /orders/?route={id}&date={YYYY-MM-DD}&status={STATUS}`
Retrieves sales orders filtered by route, date, and status.
* **Response (200 OK)**:
  ```json
  [
    {
      "id": "7f8b9c2a-1122-3344-5566-778899aabbcc",
      "order_number": "ORD-20261002-0022",
      "customer": "3c4d5e6f-7788-9900-aabb-ccddeeff0011",
      "customer_details": {
        "id": "3c4d5e6f-7788-9900-aabb-ccddeeff0011",
        "name": "Famous Kattangal",
        "phone": "9847012345",
        "current_balance": "5410.00"
      },
      "order_date": "2026-10-02",
      "status": "LOCKED",
      "total_amount": "540.00",
      "shop_expense": "0.00",
      "items": [
        {
          "product": "a1b2c3d4-0011-2233-4455-66778899aabb",
          "product_name": "Kubbus",
          "quantity": 100,
          "unit_price": "4.50",
          "subtotal": "450.00"
        },
        {
          "product": "b2c3d4e5-0011-2233-4455-66778899aabb",
          "product_name": "Romali",
          "quantity": 10,
          "unit_price": "9.00",
          "subtotal": "90.00"
        }
      ]
    }
  ]
  ```

#### `POST /orders/`
Creates a sales order, aggregates duplicate items, locks the order, and updates customer credit ledger in-place.
* **Request Body**:
  ```json
  {
    "customer": "3c4d5e6f-7788-9900-aabb-ccddeeff0011",
    "order_date": "2026-10-02",
    "items": [
      { "product": "a1b2c3d4-0011-2233-4455-66778899aabb", "quantity": 100, "unit_price": "4.50" },
      { "product": "b2c3d4e5-0011-2233-4455-66778899aabb", "quantity": 10, "unit_price": "9.00" }
    ],
    "shop_expense": "0.00",
    "notes": "Daily wholesale morning batch"
  }
  ```

---

### 5.3 Fast Daily Payment Sync (`apps.payments`)

#### `POST /payments/sync-daily-payment/`
Used by Fast Wholesale Entry to synchronize shop payments without accumulating duplicate rows.
* **Request Body**:
  ```json
  {
    "customer_id": "3c4d5e6f-7788-9900-aabb-ccddeeff0011",
    "date": "2026-10-02",
    "cash_amount": "500.00",
    "gpay_amount": "0.00",
    "order_id": "7f8b9c2a-1122-3344-5566-778899aabbcc"
  }
  ```
* **Response (200 OK)**:
  ```json
  {
    "status": "success",
    "customer_id": "3c4d5e6f-7788-9900-aabb-ccddeeff0011",
    "customer_name": "Famous Kattangal",
    "current_balance": "4910.00",
    "date": "2026-10-02",
    "cash_amount": "500.00",
    "gpay_amount": "0.00"
  }
  ```

---

### 5.4 Dynamic Customer Opening Balances (`apps.customers`)

#### `GET /customers/opening-balances/?date={YYYY-MM-DD}`
Calculates starting previous dues for all customers at the start of a target date.
* **Response (200 OK)**:
  ```json
  {
    "date": "2026-10-02",
    "count": 128,
    "opening_balances": {
      "3c4d5e6f-7788-9900-aabb-ccddeeff0011": "4870.00",
      "9a8b7c6d-5544-3322-1100-ffeeddccbbaa": "0.00"
    }
  }
  ```

---

### 5.5 Daily Business Closing (`apps.reports`)

#### `GET /reports/daily-closing/?date={YYYY-MM-DD}`
Retrieves real-time operational metrics and day open/close status.
* **Response (200 OK)**:
  ```json
  {
    "date": "2026-10-02",
    "is_opened": true,
    "is_closed": false,
    "figures": {
      "total_orders": 84,
      "total_sales": "46250.00",
      "total_collected": "38400.00",
      "cash_collected": "31200.00",
      "upi_collected": "7200.00",
      "driver_expenses": "1850.00",
      "total_staff_payouts": "2400.00",
      "net_collection": "34150.00",
      "expected_cash_in_hand": "27450.00"
    }
  }
  ```

#### `POST /reports/daily-closing/`
Submits daily closing checklist and locks operational snapshot.
* **Request Body**:
  ```json
  {
    "date": "2026-10-02",
    "notes": "Verified van cash handovers. Fuel bills logged."
  }
  ```

---

### 5.6 Database Backup & Disaster Recovery (`apps.common`)

#### `GET /database/backup/?format=sql&type=full`
Exports atomic PostgreSQL SQL dump with deferred constraints and checksum header.
* **Response Headers**:
  * `Content-Type: application/sql`
  * `Content-Disposition: attachment; filename="zamzam_backup_postgresql_full_20261002_220000.sql"`
  * `X-Backup-Checksum: a1b2c3d4e5f6...` (SHA-256)

#### `POST /database/restore/`
Uploads `.sql` or `.json` snapshot and executes transactional atomic restoration.
* **Request**: `multipart/form-data` with `file: <reconciled_clean.sql>`
* **Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "Successfully executed 1273 SQL statements from 'reconciled_clean.sql'.",
    "format": "sql",
    "statements_executed": 1273,
    "filename": "reconciled_clean.sql",
    "restored_at": "2026-10-07T18:15:00.000Z"
  }
  ```

---

## 6. Business Logic & Calculation Rules

### 6.1 Order & Financial Calculations

$$\text{Item Subtotal} = \text{Quantity} \times \text{Resolved Unit Price}$$

$$\text{Order Total Amount} = \max(0.00, \sum \text{Item Subtotals} - \text{Shop Expense})$$

$$\text{Customer Closing Due} = \text{Previous Due} + \text{Order Total Amount} - \text{Cash Paid} - \text{GPay Paid} - \text{Discount}$$

$$\text{Net Daily Collection} = \text{Total Collected} - \text{Driver Expenses} - \text{Staff Payouts}$$

$$\text{Expected Cash in Hand} = \text{Opening Float Cash} + \text{Cash Collected} - \text{Driver Expenses} - \text{Staff Cash Payouts}$$

---

### 6.2 The Historical Previous Due Rollback Formula

To calculate the exact receivable balance owed by customer $c$ at the start of date $D$ without rewriting history:

$$\text{Opening Due}(c, D) = \text{Balance}_{\text{current}}(c) - \sum_{\text{order\_date} \ge D} \text{Orders}(c) + \sum_{\text{received\_at} \ge D} \text{Payments}(c) - \sum_{\substack{\text{created\_at} \ge D \\ \text{ref\_order IS NULL}}} \text{Standalone Adjustments}(c)$$

> [!IMPORTANT]
> **Order-Linked Adjustments Exclusion Rule:**
> When an order is edited, its linked `CREDIT_SALE` entry is updated in-place. If legacy adjustments with `reference_order IS NOT NULL` were also subtracted, the difference would be double-counted. Therefore, the rollback engine strictly filters `reference_order__isnull=True`.

---

### 6.3 Effective Product Price Resolution
1. Search active `CustomerProductPrice` where `customer = C`, `product = P`, `is_active = True`, and `effective_from <= Today <= effective_to`.
2. If found and `price > 0.00`, apply negotiated custom price.
3. Otherwise, fall back to default catalog `product.unit_price`.

---

### 6.4 Staff Daily Wage Tenure Slabs
For workers with `wage_type = DEFAULT_SLAB`:
* **Tenure < 60 days (0–2 Months)**: ₹400.00 / day
* **Tenure 60–179 days (2–6 Months)**: ₹500.00 / day
* **Tenure 180–364 days (6–12 Months)**: ₹600.00 / day
* **Tenure 365–729 days (1–2 Years)**: ₹700.00 / day
* **Tenure $\ge$ 730 days (2+ Years)**: ₹800.00 / day
* **Attendance Impact**:
  * `FULL`: 100% of slab rate.
  * `HALF` (Share Members only): 50% of slab rate.
  * `LEAVE`: ₹0.00.

---

## 7. Data Flow: CRUD, Payments & Reporting

```mermaid
sequenceDiagram
    autonumber
    actor Manager as Store Manager
    participant UI as CreateOrderPage (React)
    participant API as Django REST API
    participant DB as PostgreSQL Database
    participant Ledger as Credit Ledger

    Manager->>UI: Types Kubbus (100) & Romali (10) for Famous Kattangal
    UI->>UI: Computes Subtotal: ₹540.00, Prev Due: ₹4,870.00, Ending: ₹5,410.00
    Manager->>UI: Presses Enter / Clicks Save
    UI->>API: POST /api/v1/orders/
    API->>DB: BEGIN TRANSACTION (select_for_update Customer)
    API->>DB: INSERT into apps_orders_order & items
    API->>Ledger: Mutate / Insert CREDIT_SALE (₹540.00)
    API->>DB: UPDATE Customer current_balance += ₹540.00
    API->>DB: COMMIT TRANSACTION
    API-->>UI: 201 Created (Order #ORD-20261002-0022)
    Manager->>UI: Enters Cash Paid ₹500.00
    UI->>API: POST /api/v1/payments/sync-daily-payment/
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPSERT Payment (₹500.00 Cash)
    API->>Ledger: Append CASH_PAYMENT (-₹500.00)
    API->>DB: UPDATE Customer current_balance -= ₹500.00
    API->>DB: COMMIT TRANSACTION
    API-->>UI: 200 OK (New Balance: ₹4,910.00)
```

---

## 8. Authentication, Permissions & Security

### 8.1 Dual Authentication Architecture
1. **Primary Browser Flow**: HttpOnly Cookies (`access_token`, `refresh_token`) with `SameSite=None`, `Secure=True`. JavaScript cannot access tokens, eliminating XSS token theft.
2. **Desktop & API Fallback Flow**: Standard `Authorization: Bearer <token>` stored in `localStorage` for Tauri desktop environments and testing tools.
3. **Single-Flight Refresh Mutex (`apiClient.ts`)**: When multiple concurrent requests return HTTP 401, they coalesce into a single `POST /auth/refresh/` call, preventing race conditions and token desynchronization.

### 8.2 Security Hardening
* **Password Hashing**: Django PBKDF2 with SHA-256 (390,000 iterations).
* **Settings Protection**: 4-digit PIN lock (`SystemSettings.settings_pin_code = "7667"`) required before accessing financial settings, backup tools, or reset commands.
* **Financial Immutability**: Direct `DELETE` or `PUT` on `Payment` records is rejected with HTTP 405. Reversals require an authorized reason and create an audit log.

---

## 9. Current Bugs, Logical Issues & Root-Cause Analysis

### 9.1 Solved Historical Discrepancy: The ₹31,841 Drop
* **Symptom**: Baseline pre-dues dropped from ₹3.09 Lakh to ₹2.77 Lakh after restoring un-reconciled JSON dumps.
* **Root Cause**: 64 shops with existing Oct 1 orders had their order subtotals subtracted twice from starting balances during uncoordinated export scripts.
* **Resolution**: Reconciled and locked baseline at **₹310,216.00** (~₹3.10 Lakh) in `reconciled_clean.sql`.

### 9.2 Negative Pre-Due Bug (Grill Cafe `-40`, Tasty Bekery `-30`)
* **Symptom**: On Oct 2 Fast Wholesale Entry, Grill Cafe displayed Prev. Due `-40` and Tasty Bekery displayed `-30`.
* **Root Cause**: Customers made payments on Oct 1 clearing older historical balances (e.g., Grill Cafe paid ₹1,200 on a ₹1,160 bill). Initializing starting pre-due to `0.00` resulted in a negative balance after payment deduction.
* **Resolution**: Enforced the **Zero-Dip Rule**:
  $$\text{Starting Balance} = \max(\text{Recorded Pre-Due}, \text{Payments} - \text{Orders})$$
  Locked Grill Cafe starting balance to ₹40.00 and Tasty Bekery to ₹60.00, guaranteeing zero negative dues across all 128 shops.

### 9.3 Monolithic Component Drag in `CreateOrderPage.tsx`
* **Symptom**: Sluggish typing and occasional input lag on budget Windows laptops or mobile browsers.
* **Root Cause**: `CreateOrderPage.tsx` is **7,181 lines long** in a single file. Every keystroke triggers state updates that re-render 150+ shop rows and 1,800+ DOM input elements without row virtualization.

---

## 10. Performance Optimizations & Zero-Reload UI Architecture

### 10.1 Frontend UI Bottlenecks & Fixes

```
+------------------------------------+---------------------------------------+
|        CURRENT BOTTLENECK          |         RECOMMENDED SOLUTION          |
+------------------------------------+---------------------------------------+
| 7,181-line monolithic page file    | Decompose into: RowItem, ProductCell, |
|                                    | SummaryFooter, and CustomerModal.     |
+------------------------------------+---------------------------------------+
| 2,000+ DOM inputs re-rendered      | Implement virtual windowing           |
| on every keystroke                 | (`@tanstack/react-virtual`).          |
+------------------------------------+---------------------------------------+
| Repeated full-page reloads after   | Optimistic local state updates with   |
| saving an order row                | background server confirmation.       |
+------------------------------------+---------------------------------------+
| Cold-start latency on Railway      | Background warm-up ping and           |
| sleeping instances (3-5s initial)  | persistent container tier.            |
+------------------------------------+---------------------------------------+
```

---

## 11. Railway Deployment & Environment Configuration

### 11.1 Container Architecture
* **Dockerfile**: Python 3.11-slim, `libpq-dev`, `postgresql-client` (for native `pg_dump`).
* **Static Assets**: Compiled via `python manage.py collectstatic --noinput` at build time and served through WhiteNoise.
* **Gunicorn Configuration**: 3 synchronous worker processes, binding on `0.0.0.0:8000`, 120-second timeout.
* **Entrypoint Workflow (`entrypoint.sh`)**:
  1. Executes `python manage.py migrate --noinput`.
  2. Ensures default superuser exists (`admin`).
  3. Launches Gunicorn process.

### 11.2 Required Production Environment Variables

| Variable Key | Required | Example / Description |
| :--- | :--- | :--- |
| `DJANGO_ENV` | Yes | `production` |
| `DJANGO_SECRET_KEY` | Yes | 64-character random cryptographic secret |
| `DATABASE_URL` | Yes | `postgresql://postgres:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres` |
| `DJANGO_ALLOWED_HOSTS` | Yes | `zamzamfood.up.railway.app,zamzamfoods.vercel.app` |
| `CORS_ALLOWED_ORIGINS` | Yes | `https://zamzamfoods.vercel.app,tauri://localhost` |
| `JWT_SECRET_KEY` | Yes | 64-character signing secret |
| `JWT_COOKIE_SECURE` | Yes | `True` |
| `JWT_COOKIE_SAMESITE` | Yes | `None` |
| `PERSISTENT_LOGIN_DAYS` | No | `3` (Default) |
| `CLOUDINARY_URL` | Optional | `cloudinary://API_KEY:API_SECRET@CLOUD_NAME` |

---

## 12. Recommendations: Rebuilding as a Professional Windows Desktop Application

The repository already includes Tauri v2 scaffolding in `frontend/src-tauri/`. Packaging this as a dedicated Windows Desktop Application (`.exe` / `.msi`) provides significant advantages for warehouse and counter operations:

### 12.1 Architectural Benefits of Tauri 2 on Windows
1. **Native Performance**: Lightweight WebView2 frontend with a memory footprint under 80 MB (compared to 400+ MB for Electron).
2. **Local Hardware Access**:
   * Direct USB / ESC-POS thermal printer integration for printing delivery slips without browser print dialogs.
   * Native barcode scanner listener.
3. **Offline Resilience**: Local SQLite cache stores today's route sheet; orders sync automatically when network connectivity resumes.
4. **Automated Window-Close Backup**: Captures a verified SQL snapshot to external USB drives whenever the counter app closes (`backup.rs`).

---

## 13. Proposed Local PostgreSQL + Cloud Backup/Restore Architecture

```mermaid
graph TD
    subgraph Counter Windows PC
        App[Zamzam Foods Desktop App]
        LocalDB[(Local Embedded SQLite/PostgreSQL)]
        LocalBackup[USB External Drive Daily Snapshots]
    end

    subgraph Cloud Infrastructure
        Railway[Railway Django Backend API]
        CloudDB[(Supabase Primary PostgreSQL DB)]
        S3Bucket[Cloud Encrypted WAL / SQL Storage]
    end

    App -->|Online Fast Sync| Railway
    App -->|Offline Fallback| LocalDB
    Railway --> CloudDB
    CloudDB -->|Automated Nightly pg_dump| S3Bucket
    App -->|Window Close Event| LocalBackup
```

### 13.1 Backup Redundancy Principles
1. **Tier 1 (Cloud Primary)**: Automated daily point-in-time snapshots on Supabase / Railway.
2. **Tier 2 (Desktop Local)**: Automated daily SQL dump exported to local disk (`C:\ZamzamBackups\`) on window close.
3. **Tier 3 (External Cold Storage)**: Weekly USB stick rotation.

---

## 14. Phased Implementation & Testing Plan

### Phase 1: Snapshot Application & Live Baseline Verification (Current Step)
- [ ] User restores `/Users/shiyasahmad/Downloads/reconciled_clean.sql` via Settings -> Database Restore.
- [ ] Verify Famous Kattangal Oct 1 closing (₹4,870) and Oct 2 bill (₹540) -> Oct 2 closing = ₹5,410.
- [ ] Verify zero negative previous dues across all shops.

### Phase 2: CreateOrderPage Component Modularization
- [ ] Decompose `CreateOrderPage.tsx` into smaller memoized components: `OrderTableRow.tsx`, `ProductInputCell.tsx`, `SummaryFooter.tsx`.
- [ ] Integrate `@tanstack/react-virtual` for virtualized rendering of 150+ shop rows.

### Phase 3: Windows Desktop Build & Packaging
- [ ] Run `npm run desktop:build:win` to generate the production NSIS installer (`.exe`).
- [ ] Validate automated backup creation upon application closing.
- [ ] Test ESC/POS direct thermal printing support.

---

*Documentation compiled and verified against codebase on October 7, 2026.*
