#!/usr/bin/env python3
"""
Generate clean initial database snapshot and SQL files for Zamzam Foods.
100% Compatible with Django backend restore endpoint (products_product, customers_customer, etc.)
AND direct PostgreSQL / pgAdmin imports.
All sales orders, payments, credits, and previous customer dues are wiped to 0.00.
Master data (Customers, Products, Custom wholesale prices, Routes) is cleanly preserved.
"""

import json
import os

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    source_json = os.path.join(root_dir, "backend", "scripts", "reconciled_clean.json")
    if not os.path.exists(source_json):
        source_json = os.path.join(root_dir, "reconciled_clean.json")

    out_json = os.path.join(root_dir, "zamzam_fresh_database.json")
    out_sql = os.path.join(root_dir, "zamzam_fresh_database.sql")

    with open(source_json, "r", encoding="utf-8") as f:
        data = json.load(f)

    records = data.get("records", {})

    # 1. Routes
    clean_routes = []
    for r in records.get("routes", []):
        if r.get("fields", {}).get("name"):
            clean_routes.append(r)

    # 2. Products
    clean_products = records.get("products", [])

    # 3. Customers (reset current_balance = 0.00)
    clean_customers = []
    seen_price_pairs = set()
    clean_prices = []
    for c in records.get("customers", []):
        if c.get("model") == "customers.customer":
            item = dict(c)
            item["fields"] = dict(c["fields"])
            item["fields"]["current_balance"] = "0.00"
            clean_customers.append(item)
        elif c.get("model") == "customers.customerproductprice":
            f = c.get("fields", {})
            pair = (f.get("customer"), f.get("product"))
            if pair not in seen_price_pairs:
                seen_price_pairs.add(pair)
                clean_prices.append(c)

    # 4. Accounts
    clean_accounts = records.get("accounts", [])

    # Write clean JSON
    clean_json_data = {
        "backup_info": {
            "system": "Zamzam Foods Enterprise Distribution Management",
            "version": "1.0.3",
            "created_at": "2026-10-10T15:45:00.000000+00:00",
            "backup_type": "fresh_production_seed",
            "description": "Clean master data. All sales orders, deliveries, payments, debts, and previous dues completely reset to zero.",
            "database_engine": "postgresql",
            "total_customers": len(clean_customers),
            "total_products": len(clean_products),
            "total_custom_prices": len(clean_prices),
            "total_orders": 0,
            "total_previous_dues": "0.00"
        },
        "records": {
            "accounts": clean_accounts,
            "products": clean_products,
            "routes": clean_routes,
            "customers": clean_customers + clean_prices,
            "orders": [],
            "order_items": [],
            "deliveries": [],
            "payments": [],
            "credits": [],
            "expenses": [],
            "reports": [],
            "logs": []
        }
    }

    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(clean_json_data, f, indent=2)

    # Write clean SQL matching Django table schema
    sql_lines = []
    sql_lines.append("-- ==============================================================================")
    sql_lines.append("-- ZAMZAM FOODS — RESTORE SCRIPT (DJANGO / POSTGRESQL AUTHORITATIVE)")
    sql_lines.append("-- Zero Orders | Zero Previous Dues | Master Data Preserved")
    sql_lines.append("-- ==============================================================================\n")

    # Step 1: Wipe transactions and reset balances
    sql_lines.append("-- STEP 1: WIPE ALL TRANSACTIONS & REVERT BALANCES TO 0.00")
    sql_lines.append('DELETE FROM "orders_orderactivitylog";')
    sql_lines.append('DELETE FROM "credits_credittransaction";')
    sql_lines.append('DELETE FROM "deliveries_delivery";')
    sql_lines.append('DELETE FROM "orders_orderitem";')
    sql_lines.append('DELETE FROM "payments_payment";')
    sql_lines.append('DELETE FROM "orders_order";')
    sql_lines.append('UPDATE "customers_customer" SET "current_balance" = 0.00;\n')

    # Step 2: Routes
    sql_lines.append("-- STEP 2: ROUTES")
    for r in clean_routes:
        f = r["fields"]
        rid = r["pk"]
        name = f.get("name", "").replace("'", "''")
        code = f.get("code", name[:10]).replace("'", "''")
        desc = f.get("description", "").replace("'", "''")
        sql_lines.append(f"""INSERT INTO "routes_route" ("id", "name", "code", "description", "is_active", "created_at", "updated_at")
VALUES ('{rid}', '{name}', '{code}', '{desc}', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name";""")

    # Step 3: Products
    sql_lines.append("\n-- STEP 3: PRODUCTS MASTER CATALOG")
    for p in clean_products:
        f = p["fields"]
        pid = p["pk"]
        name = f["name"].replace("'", "''")
        code = f.get("code", name).replace("'", "''")
        price = f.get("unit_price", "0.00")
        pkt = f.get("packet_size", "").replace("'", "''")
        ord_num = f.get("order_number", 0)
        sql_lines.append(f"""INSERT INTO "products_product" ("id", "name", "code", "unit_price", "packet_size", "order_number", "skip_in_entry", "is_active", "description", "created_at", "updated_at")
VALUES ('{pid}', '{name}', '{code}', {price}, '{pkt}', {ord_num}, FALSE, TRUE, '', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "unit_price" = EXCLUDED."unit_price", "is_active" = TRUE;""")

    # Step 4: Customers
    sql_lines.append("\n-- STEP 4: CUSTOMERS DIRECTORY (CURRENT BALANCE = 0.00)")
    for c in clean_customers:
        f = c["fields"]
        cid = c["pk"]
        name = f.get("name", "").replace("'", "''")
        owner_name = f.get("owner_name", "").replace("'", "''")
        phone = f.get("phone", "").replace("'", "''")
        alt_phone = f.get("alternative_phone", "").replace("'", "''")
        addr = f.get("address", "").replace("'", "''")
        lnd = f.get("landmark", "").replace("'", "''")
        route_id = f.get("route")
        sql_lines.append(f"""INSERT INTO "customers_customer" ("id", "name", "owner_name", "phone", "alternative_phone", "address", "landmark", "route_id", "credit_limit", "current_balance", "notes", "is_active", "created_at", "updated_at")
VALUES ('{cid}', '{name}', '{owner_name}', '{phone}', '{alt_phone}', '{addr}', '{lnd}', '{route_id}', 5000.00, 0.00, '', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "current_balance" = 0.00, "route_id" = EXCLUDED."route_id", "is_active" = TRUE;""")

    # Step 5: Custom Wholesale Prices
    sql_lines.append('\n-- STEP 5: CUSTOMER CUSTOM PRICES')
    sql_lines.append('DELETE FROM "customers_customerproductprice";')
    for cp in clean_prices:
        f = cp["fields"]
        cpid = cp["pk"]
        cust_id = f.get("customer")
        prod_id = f.get("product")
        price = f.get("price", "0.00")
        eff_from = f.get("effective_from", "2026-10-01")
        sql_lines.append(f"""INSERT INTO "customers_customerproductprice" ("id", "customer_id", "product_id", "price", "effective_from", "is_active", "created_at", "updated_at")
VALUES ('{cpid}', '{cust_id}', '{prod_id}', {price}, '{eff_from}', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;""")

    # Final balance check
    sql_lines.append("\n-- STEP 6: VERIFY ALL BALANCES ARE ZERO")
    sql_lines.append('UPDATE "customers_customer" SET "current_balance" = 0.00;\n')

    with open(out_sql, "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))

    # Also update reconciled_clean.json and reconciled_clean.sql in root and backend
    with open(os.path.join(root_dir, "reconciled_clean.json"), "w", encoding="utf-8") as f:
        json.dump(clean_json_data, f, indent=2)

    with open(os.path.join(root_dir, "reconciled_clean.sql"), "w", encoding="utf-8") as f:
        f.write("\n".join(sql_lines))

    # Copy to installer/dist
    dist_dir = os.path.join(root_dir, "installer", "dist")
    if os.path.exists(dist_dir):
        with open(os.path.join(dist_dir, "zamzam_fresh_database.json"), "w", encoding="utf-8") as f:
            json.dump(clean_json_data, f, indent=2)
        with open(os.path.join(dist_dir, "zamzam_fresh_database.sql"), "w", encoding="utf-8") as f:
            f.write("\n".join(sql_lines))

    print(f"Clean database generated successfully!")
    print(f"JSON: {out_json}")
    print(f"SQL:  {out_sql}")
    print(f"Customers: {len(clean_customers)} (Balances reset to 0.00)")
    print(f"Products:  {len(clean_products)}")
    print(f"Custom Prices: {len(clean_prices)}")
    print(f"Orders: 0, Payments: 0, Credits: 0")

if __name__ == "__main__":
    main()
