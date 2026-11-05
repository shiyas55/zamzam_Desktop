import os, sys, json
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
import django
django.setup()

from django.core import serializers
from django.db import transaction, connection
from apps.customers.models import Customer, CustomerProductPrice
from apps.orders.models import Order, OrderItem
from apps.payments.models import Payment
from apps.credits.models import CreditTransaction
from apps.routes.models import Route, Driver
from apps.products.models import Product

BACKUP_FILE = 'zamzam_backup_full_20261105_054807_corrected.json'

with open(BACKUP_FILE, 'r') as f:
    backup_data = json.load(f)

print(f"Loaded {BACKUP_FILE}")

# Flatten all records in dependency order
MODEL_ORDER = {
    "common.systemsettings": 1,
    "accounts.user": 2,
    "accounts.staffmember": 3,
    "routes.route": 4,
    "routes.driver": 5,
    "routes.driverexpense": 6,
    "products.product": 7,
    "customers.customer": 8,
    "customers.customerproductprice": 9,
    "orders.order": 10,
    "orders.orderitem": 11,
    "orders.orderactivitylog": 12,
    "deliveries.delivery": 13,
    "payments.payment": 14,
    "credits.credittransaction": 15,
    "reports.dailyclosing": 16,
    "common.activitylog": 17,
    "whatsapp.whatsappconversation": 18,
}

all_objects = []
for mod, recs in backup_data['records'].items():
    if isinstance(recs, list):
        all_objects.extend(recs)

all_objects.sort(key=lambda x: MODEL_ORDER.get(x.get('model', '').lower(), 99))
print(f"Total objects to deserialize and save: {len(all_objects)}")

with connection.cursor() as cur:
    cur.execute("PRAGMA foreign_keys = OFF;")

saved_count = 0
errors_count = 0

with transaction.atomic():
    for deserialized in serializers.deserialize("python", all_objects, ignorenonexistent=True):
        inst = deserialized.object
        try:
            # For OrderItem unique together conflict check
            if inst._meta.label_lower == 'orders.orderitem':
                OrderItem.objects.filter(order_id=inst.order_id, product_id=inst.product_id).exclude(pk=inst.pk).delete()
            elif inst._meta.label_lower == 'customers.customerproductprice':
                CustomerProductPrice.objects.filter(customer_id=inst.customer_id, product_id=inst.product_id).exclude(pk=inst.pk).delete()
            
            deserialized.save()
            saved_count += 1
        except Exception as e:
            errors_count += 1
            if errors_count <= 10:
                print(f"Error saving {inst._meta.label_lower} {inst.pk}: {e}")

with connection.cursor() as cur:
    cur.execute("PRAGMA foreign_keys = ON;")

print(f"\nImport Complete: Successfully saved {saved_count} objects, {errors_count} errors.")

# Verification
print("\n--- Verification in local db.sqlite3 ---")
print("Total Customers:", Customer.objects.count())
print("Total Orders:", Order.objects.count())
print("Total Payments:", Payment.objects.count())
print("Total Credit Transactions:", CreditTransaction.objects.count())

fresca = Customer.objects.filter(name__icontains='fresca').first()
if fresca:
    print(f"Fresca current_balance: {fresca.current_balance}")

# Check 28 sheet shops opening balance on 2026-11-01
from apps.customers.services import calculate_opening_balance_for_date
print("Fresca 2026-11-01 opening:", calculate_opening_balance_for_date(fresca, "2026-11-01"))
print("Fresca 2026-11-02 opening:", calculate_opening_balance_for_date(fresca, "2026-11-02"))
print("Fresca 2026-11-03 opening:", calculate_opening_balance_for_date(fresca, "2026-11-03"))
print("Fresca 2026-11-04 opening:", calculate_opening_balance_for_date(fresca, "2026-11-04"))
