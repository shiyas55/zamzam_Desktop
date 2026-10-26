# Zamzam Foods — Security Audit & Controls Specification

## 1. Security Architecture Summary

Zamzam Foods enforces a multi-tier security model designed to safeguard sensitive wholesale distribution records, customer ledgers, and financial balances.

---

## 2. Authentication & Session Management

- **JSON Web Tokens (JWT)**: Authentication is powered by `djangorestframework-simplejwt` using dual-token architecture:
  - **Short-Lived Access Tokens**: 15-minute validity window.
  - **Long-Lived Refresh Tokens**: 30-day validity window with token rotation and blacklisting on logout.
- **PIN Verification**: Sensitive administrative actions (e.g., database backups, clearing data, editing critical pricing) require independent 4-digit PIN verification.
- **Password Hashing**: Passwords use Django's PBKDF2 password hasher with SHA-256 (600,000+ iterations in production), preventing rainbow table and brute-force attacks.

---

## 3. Role-Based Access Control (RBAC) & Data Isolation

The system distinguishes three primary roles:
1. **OWNER / SUPERUSER**: Unrestricted administrative authority across all modules, ledgers, staff payouts, and financial reports.
2. **MANAGER**: Operational authority over daily order entry, route dispatch, driver shifts, and customer billing.
3. **DRIVER**: Strict data isolation enforced at the database query level. Drivers can only view customer shops and orders specifically assigned to their scheduled delivery route. IDOR URL tampering returns `404 Not Found`.

---

## 4. Financial Integrity & Transaction Protection

- **Decimal Arithmetic**: All currency values (prices, totals, discounts, payments, debts) use Python's `Decimal` and PostgreSQL's `NUMERIC(12, 2)`. Zero floating-point representation.
- **Atomic Transactions**: Orders, payments, deliveries, and credit movements are wrapped in `transaction.atomic()` to guarantee all-or-nothing execution.
- **Immutable Credit Ledger**: Customer debts are audited through signed `CreditTransaction` rows (`+` debt, `-` payment) rather than arbitrary balance overwrites.

---

## 5. Network & Transport Security

- **Enforced TLS 1.3**: All traffic between clients and backend, and between backend and Aiven Cloud PostgreSQL, is encrypted over TLS (`sslmode=require`).
- **CORS Protection**: Access is restricted strictly to authorized client domains. Wildcard origin (`*`) is disabled in production.
- **Client Credential Isolation**: Desktop clients (`.exe` and `.dmg`) do not bundle raw database administrator credentials. All requests pass through the authenticated API layer.
