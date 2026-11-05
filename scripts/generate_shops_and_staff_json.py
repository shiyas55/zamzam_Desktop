import os, sys, json
sys.path.insert(0, 'backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
import django
django.setup()

from apps.customers.models import Customer, CustomerProductPrice
from apps.accounts.models import StaffMember, User
from apps.routes.models import Route, Driver
from apps.products.models import Product
from django.core import serializers

# 1. Clean Human-Readable A-Z JSON
# Products lookup
products_map = {str(p.id): p.name for p in Product.objects.all()}
routes_map = {str(r.id): r.name for r in Route.objects.all()}

# Custom prices for each customer
custom_prices_by_cust = {}
for cpp in CustomerProductPrice.objects.select_related('customer', 'product').all():
    pname = cpp.product.name if cpp.product else products_map.get(str(cpp.product_id), 'Unknown')
    custom_prices_by_cust.setdefault(str(cpp.customer_id), {})[pname] = str(cpp.price)

# Sorted shops A to Z
customers_qs = Customer.objects.select_related('route').all().order_by('name')
shops_list = []
for c in customers_qs:
    route_name = c.route.name if c.route else routes_map.get(str(c.route_id), 'Unassigned')
    c_prices = custom_prices_by_cust.get(str(c.id), {})
    shops_list.append({
        "name": c.name.strip(),
        "owner_name": c.owner_name.strip() if c.owner_name else "",
        "phone": c.phone.strip() if c.phone else "",
        "alternative_phone": c.alternative_phone.strip() if c.alternative_phone else "",
        "address": c.address.strip() if c.address else "",
        "landmark": c.landmark.strip() if c.landmark else "",
        "route": route_name,
        "current_balance": str(c.current_balance),
        "custom_prices": c_prices,
        "notes": c.notes.strip() if c.notes else "",
        "is_active": c.is_active,
        "id": str(c.id),
    })

# Sort shops strictly A-Z (case-insensitive)
shops_list.sort(key=lambda x: x["name"].lower())

# Sorted Staff Members & Users A to Z
staff_qs = StaffMember.objects.select_related('user').all()
staff_list = []
for s in staff_qs:
    staff_list.append({
        "full_name": s.full_name.strip() if s.full_name else "",
        "username": s.user.username if s.user else "",
        "role_type": s.role_type,
        "designation": s.designation or s.role_type,
        "phone_number": s.phone_number.strip() if s.phone_number else "",
        "joined_date": str(s.joined_date) if s.joined_date else "",
        "wage_type": s.wage_type,
        "daily_wage": str(s.custom_daily_wage) if s.custom_daily_wage else "",
        "is_active": s.is_active,
        "notes": s.notes.strip() if s.notes else "",
        "id": str(s.id),
    })

# Also include System Admin / User accounts not in StaffMember
existing_usernames = {st["username"] for st in staff_list if st["username"]}
for u in User.objects.all().order_by('username'):
    if u.username not in existing_usernames:
        full_n = f"{u.first_name} {u.last_name}".strip() or u.username
        staff_list.append({
            "full_name": full_n,
            "username": u.username,
            "role_type": u.role,
            "designation": f"System {u.role}",
            "phone_number": u.phone_number or "",
            "joined_date": str(u.date_joined.date()) if u.date_joined else "",
            "wage_type": "FIXED",
            "daily_wage": "",
            "is_active": u.is_active,
            "notes": "System Account",
            "id": str(u.id),
        })

staff_list.sort(key=lambda x: x["full_name"].lower() if x["full_name"] else x["username"].lower())

# Routes list A to Z
routes_list = [{"id": str(r.id), "name": r.name, "description": r.description or "", "is_active": r.is_active} for r in Route.objects.all().order_by('name')]

# Products list A to Z
products_list = [{"id": str(p.id), "name": p.name, "code": p.code, "unit_price": str(p.unit_price) if p.unit_price else "", "is_active": p.is_active} for p in Product.objects.all().order_by('name')]

clean_json_data = {
    "system": "Zamzam Foods Distribution Management",
    "export_type": "Shops and Staff Directory (A to Z)",
    "total_shops": len(shops_list),
    "total_staff": len(staff_list),
    "total_routes": len(routes_list),
    "total_products": len(products_list),
    "shops": shops_list,
    "staff": staff_list,
    "routes": routes_list,
    "products": products_list,
}

CLEAN_JSON_PATH = "zamzam_shops_and_staff_A_to_Z.json"
with open(CLEAN_JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(clean_json_data, f, indent=2, ensure_ascii=False)

print(f"Generated clean A-Z directory: {CLEAN_JSON_PATH} ({len(shops_list)} shops, {len(staff_list)} staff)")

# 2. Django Importable Backup JSON format (for Settings -> Database Restore)
django_records = {
    "accounts": json.loads(serializers.serialize("json", User.objects.all())) + json.loads(serializers.serialize("json", StaffMember.objects.all())),
    "routes": json.loads(serializers.serialize("json", Route.objects.all())) + json.loads(serializers.serialize("json", Driver.objects.all())),
    "products": json.loads(serializers.serialize("json", Product.objects.all())),
    "customers": json.loads(serializers.serialize("json", Customer.objects.all())) + json.loads(serializers.serialize("json", CustomerProductPrice.objects.all())),
}

django_backup_data = {
    "backup_info": {
        "system": "Zamzam Foods Enterprise Distribution Management",
        "version": "1.0.0",
        "backup_type": "selective_shops_and_staff",
        "total_records": sum(len(v) for v in django_records.values()),
        "included_modules": ["accounts", "routes", "products", "customers"],
    },
    "records": django_records,
}

DJANGO_JSON_PATH = "zamzam_shops_and_staff_django_importable.json"
with open(DJANGO_JSON_PATH, "w", encoding="utf-8") as f:
    json.dump(django_backup_data, f, indent=2, ensure_ascii=False)

print(f"Generated Django-importable backup: {DJANGO_JSON_PATH}")
