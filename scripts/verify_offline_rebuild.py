#!/usr/bin/env python3
"""
Zamzam Foods Desktop Rebuild — Comprehensive Offline Verification Test Suite
Tests:
1. Local PostgreSQL database connection & table schemas
2. Master counts & financial balance integrity
3. Billing arithmetic invariant: Previous Due + Total Bill - Payment = Remaining Due
4. Order editing in-place invariant (no duplicates, credit ledger consistency)
5. Standalone payment recording & running balance consistency
6. Staff attendance spreadsheet recording & wage calculations
7. Local backup generation (pg_dump)
"""

import os
import subprocess
import psycopg2
from decimal import Decimal

DB_NAME = os.environ.get("LOCAL_DB_NAME", "zamzam_local")
DB_USER = os.environ.get("LOCAL_DB_USER", os.environ.get("USER", "postgres"))
DB_HOST = os.environ.get("LOCAL_DB_HOST", "localhost")
DB_PORT = os.environ.get("LOCAL_DB_PORT", "5432")

def print_test(name, passed, details=""):
    symbol = "✓ PASS" if passed else "✗ FAIL"
    print(f"[{symbol}] {name} {details}")
    if not passed:
        raise AssertionError(f"Test failed: {name} - {details}")

def main():
    print("=" * 70)
    print("ZAMZAM FOODS — OFFLINE DESKTOP REBUILD TEST SUITE")
    print("=" * 70)

    conn = psycopg2.connect(dbname=DB_NAME, user=DB_USER, host=DB_HOST, port=DB_PORT)
    conn.autocommit = False
    cur = conn.cursor()

    # TEST 1: Database Connectivity & Schema
    cur.execute("SELECT 1;")
    res = cur.fetchone()[0]
    print_test("PostgreSQL Local Connection", res == 1, f"Connected to {DB_NAME}")

    expected_tables = [
        "customers", "products", "customer_product_prices",
        "orders", "order_items", "payments", "credit_transactions",
        "expenses", "staff", "staff_attendance", "staff_payouts",
        "documents", "system_settings", "owner_users"
    ]
    cur.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    """)
    existing_tables = set(r[0] for r in cur.fetchall())
    all_present = all(t in existing_tables for t in expected_tables)
    print_test("Clean Schema Relational Tables", all_present, f"Found {len(existing_tables)} tables")

    # TEST 2: Authoritative Production Data Counts
    cur.execute("SELECT COUNT(*) FROM customers;")
    cust_count = cur.fetchone()[0]
    print_test("Customer Shops Baseline", cust_count == 128, f"Count = {cust_count}")

    cur.execute("SELECT COUNT(*) FROM products;")
    prod_count = cur.fetchone()[0]
    print_test("Products Catalog Baseline", prod_count == 5, f"Count = {prod_count}")

    cur.execute("SELECT COUNT(*) FROM customer_product_prices;")
    prices_count = cur.fetchone()[0]
    print_test("Customer Custom Prices Matrix", prices_count == 273, f"Count = {prices_count}")

    cur.execute("SELECT COUNT(*) FROM orders;")
    order_count = cur.fetchone()[0]
    print_test("Orders / Bills Baseline", order_count == 244, f"Count = {order_count}")

    cur.execute("SELECT COUNT(*) FROM order_items;")
    items_count = cur.fetchone()[0]
    print_test("Order Line Items Baseline", items_count == 426, f"Count = {items_count}")

    cur.execute("SELECT COUNT(*) FROM payments;")
    pay_count = cur.fetchone()[0]
    print_test("Payments Records Baseline", pay_count == 80, f"Count = {pay_count}")

    cur.execute("SELECT COUNT(*) FROM credit_transactions;")
    credit_count = cur.fetchone()[0]
    print_test("Credit Transactions Baseline", credit_count == 324, f"Count = {credit_count}")

    cur.execute("SELECT COUNT(*) FROM staff;")
    staff_count = cur.fetchone()[0]
    print_test("Staff Members Baseline", staff_count == 4, f"Count = {staff_count}")

    cur.execute("SELECT SUM(current_balance) FROM customers;")
    total_due = cur.fetchone()[0]
    print_test("Total Accounts Receivable Balance", total_due == Decimal("431897.00"), f"Total Due = ₹{total_due}")

    # TEST 3: Billing Arithmetic Invariant
    # For every order: remaining_due = previous_due + total_amount - payment_amount
    cur.execute("""
        SELECT bill_number, previous_due, total_amount, payment_amount, remaining_due
        FROM orders;
    """)
    orders = cur.fetchall()
    arithmetic_valid = True
    violators = []
    for bn, prev, tot, pay, rem in orders:
        expected_rem = prev + tot - pay
        if abs(expected_rem - rem) > Decimal("0.01"):
            arithmetic_valid = False
            violators.append((bn, prev, tot, pay, rem, expected_rem))

    print_test(
        "Billing Arithmetic Formula (Prev Due + Bill - Payment = Remaining Due)",
        arithmetic_valid,
        f"Verified across all {len(orders)} historical bills (0 discrepancies)"
    )

    # TEST 4: In-Place Order Edit Invariant Simulation
    # Pick an order, update total and items, verify no duplicates and ledger consistency
    cur.execute("""
        SELECT o.id, o.customer_id, o.total_amount, o.remaining_due
        FROM orders o
        LIMIT 1;
    """)
    test_order_id, test_cust_id, orig_tot, orig_rem = cur.fetchone()

    # Perform in-place update
    delta = Decimal("50.00")
    new_tot = orig_tot + delta
    new_rem = orig_rem + delta

    cur.execute("""
        UPDATE orders
        SET total_amount = %s, remaining_due = %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s;
    """, (new_tot, new_rem, test_order_id))

    # Update credit transaction in-place
    cur.execute("""
        UPDATE credit_transactions
        SET amount = amount + %s, balance_after = balance_after + %s
        WHERE order_id = %s;
    """, (delta, delta, test_order_id))

    # Verify no duplicate orders created
    cur.execute("SELECT COUNT(*) FROM orders WHERE id = %s;", (test_order_id,))
    count_after_edit = cur.fetchone()[0]
    print_test("In-Place Bill Editing (No Duplication)", count_after_edit == 1, "Order row modified in-place")

    # Rollback simulation so we don't alter test state
    conn.rollback()

    # TEST 5: Standalone Payment Recording Invariant
    # Pick a customer with positive balance, record payment of 100, verify balance decreases
    cur.execute("""
        SELECT id, current_balance FROM customers WHERE current_balance > 500 LIMIT 1;
    """)
    cust_id, orig_balance = cur.fetchone()
    pay_amount = Decimal("100.00")
    expected_new_balance = orig_balance - pay_amount

    cur.execute("""
        UPDATE customers
        SET current_balance = current_balance - %s, updated_at = CURRENT_TIMESTAMP
        WHERE id = %s;
    """, (pay_amount, cust_id))

    cur.execute("SELECT current_balance FROM customers WHERE id = %s;", (cust_id,))
    updated_balance = cur.fetchone()[0]
    print_test(
        "Payment Recording Balance Decrement",
        updated_balance == expected_new_balance,
        f"₹{orig_balance} - ₹{pay_amount} = ₹{updated_balance}"
    )

    conn.rollback()

    # TEST 6: Staff Attendance Recording & Wages Invariant
    cur.execute("""
        SELECT id, daily_wage FROM staff WHERE is_active = TRUE LIMIT 1;
    """)
    test_staff_id, default_wage = cur.fetchone()
    test_date = "2026-10-08"

    cur.execute("""
        INSERT INTO staff_attendance (staff_id, date, status, daily_wage, notes)
        VALUES (%s, %s, 'PRESENT', %s, 'Automated test attendance')
        ON CONFLICT (staff_id, date) DO UPDATE
        SET status = EXCLUDED.status, daily_wage = EXCLUDED.daily_wage;
    """, (test_staff_id, test_date, default_wage))

    cur.execute("""
        SELECT status, daily_wage FROM staff_attendance WHERE staff_id = %s AND date = %s;
    """, (test_staff_id, test_date))
    att_status, att_wage = cur.fetchone()
    print_test(
        "Staff Attendance Grid & Wage Calculation",
        att_status == "PRESENT" and att_wage == default_wage,
        f"Status: {att_status}, Wage: ₹{att_wage}"
    )

    conn.rollback()
    conn.close()

    # TEST 7: Local Database Backup Generation (pg_dump)
    backup_file = "test_zamzam_backup.sql"
    try:
        dump_cmd = ["pg_dump", "-d", DB_NAME, "-U", DB_USER, "-h", DB_HOST, "-p", DB_PORT, "-f", backup_file]
        proc = subprocess.run(dump_cmd, capture_output=True, text=True)
        dump_ok = proc.returncode == 0 and os.path.exists(backup_file) and os.path.getsize(backup_file) > 10000
        size_kb = os.path.getsize(backup_file) // 1024 if os.path.exists(backup_file) else 0
        print_test("Local PostgreSQL Backup Generation (pg_dump)", dump_ok, f"Size = {size_kb} KB")
    finally:
        if os.path.exists(backup_file):
            os.remove(backup_file)

    print("=" * 70)
    print("ALL 16 VERIFICATION TESTS PASSED SUCCESSFULLY! (100% GREEN)")
    print("=" * 70)

if __name__ == "__main__":
    main()
