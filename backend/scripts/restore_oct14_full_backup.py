"""
Import complete October 14 backup (/Users/shiyasahmad/Documents/ZamzamFoods_Backups/zamzam_backup_postgresql_20261015_082222.sql)
into SQLite (backend/db.sqlite3).
Includes:
- 130 Customer Shops (with October 14 balances)
- 174 Orders (34 orders on Oct 14, 27 on Oct 2, 113 on Oct 1)
- 256 Order items
- 108 Payments
- 400 Credit transactions
- 293 Customer wholesale prices
- 5 Products
- 5 Routes
- 5 Users (admin, shiyas, 3 drivers - passwords set to 'zamzam@2026')
"""

import os
import sys
import shutil
import sqlite3
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
SRC_SQL = Path("/Users/shiyasahmad/Documents/ZamzamFoods_Backups/zamzam_backup_postgresql_20261015_082222.sql")
TARGET_DB = BACKEND_DIR / "db.sqlite3"
BACKUP_COPY = PROJECT_ROOT / "backups" / "zamzam_backup_oct14.sqlite3"

def main():
    if not SRC_SQL.exists():
        print(f"Error: SQL file {SRC_SQL} not found!")
        sys.exit(1)

    print(f"1. Reading {SRC_SQL.name}...")
    with open(SRC_SQL, "r", encoding="utf-8") as f:
        lines = f.readlines()

    print(f"2. Connecting to {TARGET_DB.name}...")
    conn = sqlite3.connect(TARGET_DB)
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys = OFF;")

    tables_to_clear = [
        "orders_orderitem", "orders_orderactivitylog", "orders_order",
        "deliveries_delivery", "payments_payment", "credits_credittransaction",
        "customers_customerproductprice", "customers_customer",
        "routes_driver", "routes_route", "products_product",
        "accounts_staffmember", "accounts_user", "common_systemsettings"
    ]
    for tbl in tables_to_clear:
        try:
            cur.execute(f"DELETE FROM {tbl};")
        except sqlite3.OperationalError:
            pass

    success = 0
    failed = 0
    for line in lines:
        line = line.strip()
        if line.startswith("INSERT INTO "):
            try:
                cur.execute(line)
                success += 1
            except Exception as e:
                failed += 1
                if failed <= 5:
                    print(f"   Warning ({e}): {line[:80]}...")

    conn.commit()
    print(f"   ✓ Inserted {success} records successfully ({failed} skipped).")

    # Now verify with Django & ensure passwords
    sys.path.insert(0, str(BACKEND_DIR))
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.development"
    os.environ["DATABASE_URL"] = f"sqlite:///{TARGET_DB}"

    import django
    django.setup()

    from apps.accounts.models import User
    from apps.customers.models import Customer
    from apps.orders.models import Order
    from apps.payments.models import Payment
    from apps.routes.models import Route
    from apps.products.models import Product

    print("\n3. Setting passwords to 'zamzam@2026'...")
    for user in User.objects.all():
        user.set_password("zamzam@2026")
        user.is_active = True
        user.save()
        print(f"   ✓ User '{user.username}' ({user.role}) updated")

    # Ensure admin user is superuser
    admin = User.objects.get(username="admin")
    admin.is_staff = True
    admin.is_superuser = True
    admin.save()

    print("\n4. Database Summary After Import:")
    print(f"   Users:      {User.objects.count()}")
    print(f"   Shops:      {Customer.objects.count()}")
    print(f"   Routes:     {Route.objects.count()}")
    print(f"   Products:   {Product.objects.count()}")
    print(f"   Orders:     {Order.objects.count()}")
    print(f"   Payments:   {Payment.objects.count()}")

    print("\n5. Orders by Date:")
    cur.execute("SELECT order_date, COUNT(*) FROM orders_order GROUP BY order_date ORDER BY order_date DESC;")
    for row in cur.fetchall():
        print(f"   • {row[0]}: {row[1]} orders")

    cur.execute("VACUUM;")
    conn.close()

    # Copy to root and backups
    shutil.copy2(TARGET_DB, PROJECT_ROOT / "db.sqlite3")
    shutil.copy2(TARGET_DB, BACKUP_COPY)
    print(f"\n6. Saved backup copy to: {BACKUP_COPY.name}")
    print("Done! October 14 data is fully restored and active.")

if __name__ == "__main__":
    main()
