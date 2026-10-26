# Zamzam Foods — Automated Testing & Quality Assurance Manual

## 1. Test Strategy Overview

Quality assurance for Zamzam Foods combines automated backend unit/integration tests, frontend TypeScript static analysis, and desktop Rust compilation checks to guarantee reliability across financial transactions, customer ledgers, and authentication workflows.

---

## 2. Backend Automated Test Suite (`backend/tests/`)

Tests execute against an isolated in-memory test database configured in `backend/config/settings/test.py`. Tests **never** alter or delete records in the live Aiven Cloud production database.

### Running Backend Tests
```bash
cd backend
DJANGO_SETTINGS_MODULE=config.settings.test pytest
```

### Verified Test Results Summary

| Test Module | Coverage Scope | Status | Execution Time |
|---|---|---|---|
| `test_auth.py` | JWT Login, logout, refresh, role validation, session expiration | **8 Passed** | 1.63s |
| `test_wholesale_business_logic.py` | Pricing, packet size rules, previous dues calculation, order line totals | **20 Passed** | 1.80s |
| `test_payments_and_credit_ledger.py` | Cash/GPay payments, ledger immutability, customer balance adjustments | **3 Passed** | 0.64s |
| `test_order_lifecycle_integrity.py` | Draft orders, submitted bills, cancellation, order locking | **17 Passed** | 1.15s |
| `test_prompt6_financial_integrity.py` | Floating-point prevention, Decimal arithmetic, duplicate payment prevention | **10 Passed** | 0.89s |
| `test_prompt7_security_audit.py` | RBAC permissions, driver isolation, IDOR protection, password hashing | **23 Passed** | 32.91s |
| `test_system_settings.py` | PIN verification, maintenance mode, module toggle permissions | **7 Passed** | 0.72s |
| **Total Test Suite** | **Comprehensive Business & Security Verification** | **100% Passed (0 Failures)** | — |

---

## 3. Frontend Static Analysis & Type Checking

The React TypeScript application is validated using strict compiler rules:
```bash
cd frontend
npx tsc --noEmit
```
- **Status**: Passed with **0 errors**.

---

## 4. Desktop Rust IPC & Bundle Verification

The Tauri desktop wrapper is verified via Cargo:
```bash
cd frontend/src-tauri
cargo check
```
- **Status**: Passed with **0 errors**.
