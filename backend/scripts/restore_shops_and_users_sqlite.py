"""
Restore only Shops and Users from SQLite backup.
Keeps:
- accounts_user (5 users: admin, shiyas, driver_s, driver_a, driver_f)
- accounts_staffmember (3 staff records)
- routes_route (5 routes)
- routes_driver (3 route-driver assignments)
- products_product (5 products)
- customers_customer (128 customer shops)
- customers_customerproductprice (275 customer prices)

Clears (0 count):
- orders_order, orders_orderitem, orders_orderactivitylog
- deliveries_delivery
- payments_payment
- credits_credittransaction
- reports_dailyclosing
- routes_drivershift, routes_driverexpense
- common_activitylog, django_admin_log, django_session
- token_blacklist tokens
"""

import os
import sys
import shutil
import sqlite3
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
BACKUP_SQLITE = PROJECT_ROOT / "backups" / "zamzam_sqlite_20261005_203302.sqlite3"
TARGET_SQLITE = BACKEND_DIR / "db.sqlite3"
CLEAN_BACKUP = PROJECT_ROOT / "backups" / "zamzam_clean_shops_and_users.sqlite3"

def main():
    if not BACKUP_SQLITE.exists():
        print(f"Error: Source backup {BACKUP_SQLITE} not found!")
        sys.exit(1)

    print(f"1. Copying {BACKUP_SQLITE.name} -> {TARGET_SQLITE.name}...")
    shutil.copy2(BACKUP_SQLITE, TARGET_SQLITE)

    conn = sqlite3.connect(TARGET_SQLITE)
    cur = conn.cursor()

    tables_to_clear = [
        "orders_orderitem",
        "orders_orderactivitylog",
        "orders_order",
        "deliveries_delivery",
        "payments_payment",
        "credits_credittransaction",
        "reports_dailyclosing",
        "routes_drivershift",
        "routes_driverexpense",
        "common_activitylog",
        "django_admin_log",
        "django_session",
        "token_blacklist_blacklistedtoken",
        "token_blacklist_outstandingtoken",
    ]

    print("\n2. Clearing old orders, deliveries, payments, and activity logs...")
    for tbl in tables_to_clear:
        try:
            cur.execute(f"DELETE FROM {tbl};")
            print(f"   ✓ Cleared table: {tbl}")
        except sqlite3.OperationalError as e:
            print(f"   - Skipped {tbl} ({e})")

    conn.commit()
    cur.execute("VACUUM;")
    conn.close()

    # Now use Django to set standard passwords and verify integrity
    sys.path.insert(0, str(BACKEND_DIR))
    os.environ["DJANGO_SETTINGS_MODULE"] = "config.settings.development"
    os.environ["DATABASE_URL"] = f"sqlite:///{TARGET_SQLITE}"

    import django
    django.setup()

    from apps.accounts.models import User
    from apps.customers.models import Customer
    from apps.routes.models import Route
    from apps.products.models import Product
    from apps.orders.models import Order
    from apps.payments.models import Payment

    print("\n3. Resetting user passwords to 'zamzam@2026'...")
    for user in User.objects.all():
        user.set_password("zamzam@2026")
        user.is_active = True
        user.save()
        print(f"   ✓ User '{user.username}' ({user.role}) updated with password 'zamzam@2026'")

    # Also make sure master admin exists
    admin_user, _ = User.objects.get_or_create(username="admin", defaults={"role": "OWNER", "is_staff": True, "is_superuser": True})
    admin_user.set_password("zamzam@2026")
    admin_user.is_staff = True
    admin_user.is_superuser = True
    admin_user.is_active = True
    admin_user.save()

    print("\n4. Final Database Counts:")
    print(f"   Users:      {User.objects.count()}")
    print(f"   Routes:     {Route.objects.count()}")
    print(f"   Shops:      {Customer.objects.count()}")
    print(f"   Products:   {Product.objects.count()}")
    print(f"   Orders:     {Order.objects.count()}")
    print(f"   Payments:   {Payment.objects.count()}")

    # Save a clean copy into backups/
    shutil.copy2(TARGET_SQLITE, CLEAN_BACKUP)
    print(f"\n5. Clean backup saved to: {CLEAN_BACKUP.name}")
    print("Done! Database successfully restored with ONLY shops and users.")

if __name__ == "__main__":
    main()
