#!/usr/bin/env python3
"""
Zamzam Foods Desktop — Local PostgreSQL Data Migration Script
Transfers all authoritative production records from reconciled_clean.json
into the clean local PostgreSQL database (zamzam_local).
"""

import os
import json
import psycopg2
from decimal import Decimal

DB_NAME = os.environ.get("LOCAL_DB_NAME", "zamzam_local")
DB_USER = os.environ.get("LOCAL_DB_USER", os.environ.get("USER", "postgres"))
DB_HOST = os.environ.get("LOCAL_DB_HOST", "localhost")
DB_PORT = os.environ.get("LOCAL_DB_PORT", "5432")

def main():
    print(f"Connecting to local PostgreSQL database '{DB_NAME}' on {DB_HOST}:{DB_PORT} as '{DB_USER}'...")
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        host=DB_HOST,
        port=DB_PORT
    )
    conn.autocommit = False
    cur = conn.cursor()

    json_path = "reconciled_clean.json"
    print(f"Reading snapshot from '{json_path}'...")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = data.get("records", {})

    try:
        # 1. Routes map
        route_map = {}
        for it in records.get("routes", []):
            if it.get("model") == "routes.route":
                route_map[it["pk"]] = it["fields"].get("name", "")

        # 2. Insert Default Owner User
        print("1/10 Initializing Owner user...")
        cur.execute("""
            INSERT INTO owner_users (id, username, password_hash, full_name, pin_code)
            VALUES ('00000000-0000-0000-0000-000000000001', 'owner', 'pbkdf2_sha256$default$hash', 'Zamzam Owner', '7667')
            ON CONFLICT (username) DO NOTHING;
        """)

        # 3. Insert Products
        print("2/10 Migrating Products...")
        prod_count = 0
        for it in records.get("products", []):
            if it.get("model") == "products.product":
                f = it["fields"]
                cur.execute("""
                    INSERT INTO products (id, name, code, unit_price, packet_size, order_number, is_active, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        unit_price = EXCLUDED.unit_price,
                        order_number = EXCLUDED.order_number;
                """, (
                    it["pk"], f.get("name"), f.get("code"),
                    f.get("unit_price", 0.00), f.get("packet_size", ""),
                    f.get("order_number", 0), f.get("is_active", True),
                    f.get("description", "")
                ))
                prod_count += 1
        print(f"   -> {prod_count} products migrated.")

        # 4. Insert Customers
        print("3/10 Migrating Customers...")
        cust_count = 0
        for it in records.get("customers", []):
            if it.get("model") == "customers.customer":
                f = it["fields"]
                r_name = route_map.get(f.get("route"), "")
                cur.execute("""
                    INSERT INTO customers (id, name, owner_name, phone, alternative_phone, address, route_name, opening_due, current_balance, notes, is_active, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        current_balance = EXCLUDED.current_balance,
                        route_name = EXCLUDED.route_name;
                """, (
                    it["pk"], f.get("name"), f.get("owner_name", ""),
                    f.get("phone", ""), f.get("alternative_phone", ""),
                    f.get("address", ""), r_name,
                    0.00, f.get("current_balance", 0.00),
                    f.get("notes", ""), f.get("is_active", True),
                    f.get("created_at"), f.get("updated_at")
                ))
                cust_count += 1
        print(f"   -> {cust_count} customers migrated.")

        # 5. Insert Customer Custom Prices
        print("4/10 Migrating Customer Custom Product Prices...")
        price_count = 0
        for it in records.get("customers", []):
            if it.get("model") == "customers.customerproductprice":
                f = it["fields"]
                cur.execute("""
                    INSERT INTO customer_product_prices (id, customer_id, product_id, price, effective_from, effective_to, is_active, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price;
                """, (
                    it["pk"], f.get("customer"), f.get("product"),
                    f.get("price", 0.00), f.get("effective_from"),
                    f.get("effective_to"), f.get("is_active", True),
                    f.get("created_at"), f.get("updated_at")
                ))
                price_count += 1
        print(f"   -> {price_count} custom price rules migrated.")

        # 6. Insert Orders (Bills)
        print("5/10 Migrating Orders / Bills...")
        order_count = 0
        for it in records.get("orders", []):
            if it.get("model") == "orders.order":
                f = it["fields"]
                tot = Decimal(str(f.get("total_amount", "0.00")))
                exp = Decimal(str(f.get("shop_expense", "0.00")))
                sub = tot + exp
                cur.execute("""
                    INSERT INTO orders (id, bill_number, customer_id, bill_date, subtotal, discount, total_amount, previous_due, payment_amount, remaining_due, payment_method, notes, status, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        bill_number = EXCLUDED.bill_number,
                        total_amount = EXCLUDED.total_amount;
                """, (
                    it["pk"], f.get("order_number"), f.get("customer"),
                    f.get("order_date"), sub, exp, tot,
                    0.00, 0.00, tot, "CASH",
                    f.get("notes", ""), f.get("status", "COMPLETED"),
                    f.get("created_at"), f.get("updated_at")
                ))
                order_count += 1
        print(f"   -> {order_count} orders migrated.")

        # 7. Insert Order Items
        print("6/10 Migrating Order Line Items...")
        item_count = 0
        for it in records.get("orders", []):
            if it.get("model") == "orders.orderitem":
                f = it["fields"]
                cur.execute("""
                    INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, subtotal, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (order_id, product_id) DO UPDATE SET
                        quantity = EXCLUDED.quantity,
                        unit_price = EXCLUDED.unit_price,
                        subtotal = EXCLUDED.subtotal;
                """, (
                    it["pk"], f.get("order"), f.get("product"),
                    f.get("quantity", 0), f.get("unit_price", 0.00),
                    f.get("subtotal", 0.00),
                    f.get("created_at"), f.get("updated_at")
                ))
                item_count += 1
        print(f"   -> {item_count} order line items migrated.")

        # 8. Insert Payments
        print("7/10 Migrating Payments...")
        pay_count = 0
        for it in records.get("payments", []):
            if it.get("model") == "payments.payment":
                f = it["fields"]
                cur.execute("""
                    INSERT INTO payments (id, payment_number, customer_id, order_id, amount, payment_method, reference_number, received_at, notes, status, reversal_reason, reversed_at, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        amount = EXCLUDED.amount,
                        status = EXCLUDED.status;
                """, (
                    it["pk"], f.get("payment_number"), f.get("customer"),
                    f.get("order"), f.get("amount", 0.00),
                    f.get("payment_method", "CASH"), f.get("reference_number", ""),
                    f.get("received_at"), f.get("notes", ""),
                    f.get("status", "COMPLETED"), f.get("reversal_reason", ""),
                    f.get("reversed_at"),
                    f.get("created_at"), f.get("updated_at")
                ))
                pay_count += 1
        print(f"   -> {pay_count} payments migrated.")

        # 9. Insert Credit Ledger
        print("8/10 Migrating Credit Ledger Transactions...")
        credit_count = 0
        for it in records.get("credits", []):
            if it.get("model") == "credits.credittransaction":
                f = it["fields"]
                cur.execute("""
                    INSERT INTO credit_transactions (id, customer_id, transaction_type, amount, balance_after, order_id, payment_id, notes, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                """, (
                    it["pk"], f.get("customer"), f.get("transaction_type"),
                    f.get("amount", 0.00), f.get("balance_after", 0.00),
                    f.get("reference_order"), f.get("reference_payment"),
                    f.get("notes", ""), f.get("created_at")
                ))
                credit_count += 1
        print(f"   -> {credit_count} ledger entries migrated.")

        # 10. Insert Staff
        print("9/10 Migrating Staff Profiles...")
        staff_count = 0
        for it in records.get("accounts", []):
            if it.get("model") == "accounts.staffmember":
                f = it["fields"]
                cur.execute("""
                    INSERT INTO staff (id, full_name, phone_number, address, joined_date, staff_type, salary_type, daily_wage, is_active, notes, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;
                """, (
                    it["pk"], f.get("full_name"), f.get("phone_number", ""),
                    "", f.get("joined_date"),
                    f.get("designation", "Staff"), f.get("wage_type", "DEFAULT_SLAB"),
                    f.get("custom_daily_wage") or 500.00, f.get("is_active", True),
                    f.get("notes", ""), f.get("created_at"), f.get("updated_at")
                ))
                staff_count += 1
        print(f"   -> {staff_count} staff members migrated.")

        # 11. Insert System Settings
        print("10/10 Migrating System Settings...")
        settings_migrated = False
        for it in records.get("logs", []):
            if it.get("model") == "common.systemsettings":
                f = it["fields"]
                cur.execute("""
                    INSERT INTO system_settings (id, business_name, phone_number, gst_number, address, upi_id, invoice_footer_notes, pin_code, auto_backup_enabled, backup_on_close, fallback_backup_time, retention_count)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        business_name = EXCLUDED.business_name,
                        phone_number = EXCLUDED.phone_number,
                        pin_code = EXCLUDED.pin_code;
                """, (
                    it["pk"], f.get("business_name", "Zamzam Foods"),
                    f.get("phone_number", "+91 98470 12345"), f.get("gst_number", ""),
                    f.get("address", "Main Road, Pandikkad"), f.get("upi_id", ""),
                    f.get("invoice_footer_notes", "Thank you for your business."),
                    f.get("settings_pin_code", "7667"),
                    True, True, "23:59", 30
                ))
                settings_migrated = True
                break

        if not settings_migrated:
            cur.execute("""
                INSERT INTO system_settings (id, business_name, phone_number, pin_code)
                VALUES ('00000000-0000-0000-0000-000000000001', 'Zamzam Foods', '+91 98470 12345', '7667')
                ON CONFLICT (id) DO NOTHING;
            """)

        conn.commit()
        print("\n========================================================")
        print("SUCCESS! Complete production dataset migrated into 'zamzam_local'.")
        print("========================================================")

        # Verification Query
        cur.execute("SELECT count(*) FROM customers;")
        total_cust = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM orders;")
        total_orders = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM payments;")
        total_pays = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM credit_transactions;")
        total_credits = cur.fetchone()[0]
        cur.execute("SELECT sum(current_balance) FROM customers;")
        total_receivable = cur.fetchone()[0]

        print(f"Verified Records in zamzam_local:")
        print(f"  Customers:            {total_cust}")
        print(f"  Orders:               {total_orders}")
        print(f"  Payments:             {total_pays}")
        print(f"  Credit Transactions:  {total_credits}")
        print(f"  Total Receivable Due: ₹{total_receivable:,.2f}")

    except Exception as e:
        conn.rollback()
        print(f"ERROR: Migration failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
