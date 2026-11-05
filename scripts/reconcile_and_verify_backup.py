import os, sys, json, uuid
from decimal import Decimal
from datetime import datetime

INPUT_FILE = 'zamzam_backup_full_20261105_054807.json'
OUTPUT_FILE = 'zamzam_backup_full_20261105_054807_corrected.json'

with open(INPUT_FILE, 'r') as f:
    data = json.load(f)

print(f"Loaded {INPUT_FILE}")

# Index records
customers = {c['pk']: c for c in data['records']['customers'] if c.get('model') == 'customers.customer'}
orders = {o['pk']: o for o in data['records']['orders'] if o.get('model') == 'orders.order'}
order_items = [oi for oi in data['records']['orders'] if oi.get('model') == 'orders.orderitem']
payments = {p['pk']: p for p in data['records']['payments'] if p.get('model') == 'payments.payment'}
credits = [c for c in data['records']['credits'] if c.get('model') == 'credits.credittransaction']

# 1. Correct Order Totals from OrderItems
items_by_order = {}
for oi in order_items:
    oid = oi['fields']['order']
    items_by_order.setdefault(oid, []).append(oi)

fixed_orders_count = 0
for oid, o in orders.items():
    its = items_by_order.get(oid, [])
    if its:
        calculated_tot = sum(Decimal(str(it['fields']['subtotal'])) for it in its).quantize(Decimal('0.01'))
        stored_tot = Decimal(str(o['fields']['total_amount'])).quantize(Decimal('0.01'))
        if calculated_tot != stored_tot:
            o['fields']['total_amount'] = str(calculated_tot)
            fixed_orders_count += 1

print(f"Corrected {fixed_orders_count} orders where total_amount != item subtotals sum.")

# Sync CREDIT_SALE credit transaction amounts with their reference_order
credits_by_order = {}
for c in credits:
    if c['fields']['transaction_type'] == 'CREDIT_SALE' and c['fields'].get('reference_order'):
        credits_by_order[c['fields']['reference_order']] = c

fixed_credit_sales_count = 0
for oid, o in orders.items():
    cr = credits_by_order.get(oid)
    if cr:
        ord_tot = Decimal(str(o['fields']['total_amount'])).quantize(Decimal('0.01'))
        cr_amt = Decimal(str(cr['fields']['amount'])).quantize(Decimal('0.01'))
        if ord_tot != cr_amt:
            cr['fields']['amount'] = str(ord_tot)
            fixed_credit_sales_count += 1

print(f"Corrected {fixed_credit_sales_count} credit sale records to match order totals.")

# 2. Sheet Starting Dues for November 1 (2026-11-01)
sheet_due_by_cid = {
    'd46085e1-ef78-4a53-99b6-0a0f9acce034': Decimal('50.00'),   # miya miya
    '1d049c43-2af2-4a19-8c52-7fa0308ca8ea': Decimal('0.00'),    # fresca
    '037aef4b-6d12-4ad3-ba59-478a4104fea7': Decimal('0.00'),    # mart kattangal
    '500e6118-e0ff-4000-985c-5fb0c291a591': Decimal('35.00'),   # sweet valley
    '50eedcfe-7830-42cf-b7e8-baff55c7a444': Decimal('0.00'),    # AR bekery
    '2c4e3160-a549-42e5-81e7-007f6759d558': Decimal('790.00'),  # FAMOUS KATTANGAL
    'abb3e630-c065-440a-8701-0d4f70b533db': Decimal('850.00'),  # broast
    '159927bc-d59c-42bd-b4e7-2c4c15f7aef6': Decimal('1170.00'), # tasty bekery (riyas)
    'a0421574-6334-4b84-a5e5-46243cff2d4a': Decimal('1675.00'), # smokies
    'c1cf92ef-7902-40f5-9c6e-be5ae7df1322': Decimal('50.00'),   # mandi shop
    '0d653df0-863e-4afe-a906-5ccbf494679b': Decimal('0.00'),    # raidan kallanthode
    '57bd5f24-146e-4a51-a989-d71ad8e98897': Decimal('90.00'),   # msr corner
    '2d35e722-d6ee-4fc0-9f0c-ec6a262bfa45': Decimal('2040.00'), # nook manasseri
    '77aaf71d-58b6-478c-83b0-185d8729f1a1': Decimal('0.00'),    # brothers mukkam
    '75352512-01fb-4a40-8068-aa762b289e85': Decimal('2170.00'), # donor mukkam
    '0d72471e-d721-4102-a751-33b0af323102': Decimal('0.00'),    # mukkam rumali
    '6760d06b-2b90-4487-936d-38b4fe162eb7': Decimal('25000.00'),# thurkish kattangal
    '0889dc8d-eb0f-4376-9685-a47c0ab331cc': Decimal('1480.00'), # chai kattangal
    '5e6a19ca-5008-47c2-8865-396e175b2e92': Decimal('0.00'),    # galaxy
    '960fa41b-75b4-4855-a7ef-57c51d47e916': Decimal('0.00'),    # nit kattangal
    '346d0ee8-2f70-474b-b32b-f06cbc3f4660': Decimal('0.00'),    # nkg
    '631a1b07-6104-488e-9ec1-dae8fa71b1ff': Decimal('1210.00'), # corner narikkuni stand
    'd60478ba-8252-4856-bcd9-360195648218': Decimal('0.00'),    # pappaya pullaloor
    '24dd2fa4-7aae-4fc6-ae0c-b191d934e897': Decimal('0.00'),    # pachu bakery
    'd4a18ab0-6880-4ce8-b6fc-6af1575a640a': Decimal('1160.00'), # happy kiyakkoth koduvally
    'a303dabb-4ea7-4efd-a15b-eb5272f4f3fd': Decimal('1480.00'), # king felafil koduvally
    '97b29e8e-b39a-4b8f-ba8d-df17f096408c': Decimal('1402.00'), # alfain koduvally
    '6d0fab5b-f5a1-4d69-91b0-2b7ad7274f43': Decimal('1520.00'), # chai.in
}

# Remove any previously added physical sheet adjustments to avoid duplicates
credits = [c for c in credits if not ('Previous due on 2026-11-01' in c['fields'].get('notes', ''))]

adj_added = 0
for cid, target_due in sheet_due_by_cid.items():
    ord_sum = sum(Decimal(str(o['fields']['total_amount'])) for o in orders.values() if o['fields']['customer'] == cid and o['fields']['order_date'] <= '2026-10-31')
    pmt_sum = sum(Decimal(str(p['fields']['amount'])) for p in payments.values() if p['fields']['customer'] == cid and str(p['fields']['received_at'])[:10] <= '2026-10-31')
    adj_sum = sum(Decimal(str(c['fields']['amount'])) for c in credits if c['fields']['customer'] == cid and c['fields']['transaction_type'] == 'ADJUSTMENT' and str(c['fields']['created_at'])[:10] <= '2026-10-31')
    
    current_oct_end = ord_sum - pmt_sum + adj_sum
    diff = (target_due - current_oct_end).quantize(Decimal('0.01'))
    
    # Create adjustment at 2026-11-01 00:00:01
    new_adj = {
        'model': 'credits.credittransaction',
        'pk': str(uuid.uuid4()),
        'fields': {
            'created_at': '2026-11-01 00:00:01+00:00',
            'updated_at': '2026-11-01 00:00:01+00:00',
            'customer': cid,
            'transaction_type': 'ADJUSTMENT',
            'amount': str(diff),
            'balance_after': str(target_due),
            'reference_order': None,
            'reference_payment': None,
            'notes': f"Previous due on 2026-11-01 set to ₹{target_due} from Fast Wholesale Entry",
            'recorded_by': 1
        }
    }
    credits.append(new_adj)
    adj_added += 1

print(f"Created {adj_added} adjustments for 2026-11-01 physical sheet alignment.")

# Update credits list in records
data['records']['credits'] = credits

# 3. Sequential Re-Chaining of ALL Credit Transactions for ALL Customers
credits_by_cust = {}
for c in credits:
    credits_by_cust.setdefault(c['fields']['customer'], []).append(c)

total_rechained = 0
for cid, c_obj in customers.items():
    cust_credits = credits_by_cust.get(cid, [])
    
    def get_sort_key(cr):
        f = cr['fields']
        if f.get('reference_order') and f['reference_order'] in orders:
            d_str = orders[f['reference_order']]['fields']['order_date']
        elif f.get('reference_payment') and f['reference_payment'] in payments:
            d_str = str(payments[f['reference_payment']]['fields']['received_at'])[:10]
        else:
            d_str = str(f['created_at'])[:10]
        type_priority = 0 if f['transaction_type'] == 'ADJUSTMENT' else (1 if f['transaction_type'] == 'CREDIT_SALE' else 2)
        return (d_str, type_priority, str(f['created_at']))
    
    cust_credits.sort(key=get_sort_key)
    
    running_balance = Decimal('0.00')
    for idx, cr in enumerate(cust_credits):
        f = cr['fields']
        ttype = f['transaction_type']
        amt = Decimal(str(f['amount']))
        
        if f.get('reference_order') and f['reference_order'] in orders:
            tx_date = orders[f['reference_order']]['fields']['order_date']
        elif f.get('reference_payment') and f['reference_payment'] in payments:
            tx_date = str(payments[f['reference_payment']]['fields']['received_at'])[:10]
        else:
            tx_date = str(f['created_at'])[:10]
        
        sec = idx % 60
        if ttype == 'ADJUSTMENT':
            time_part = f"00:00:{sec:02d}.000000+00:00"
        elif ttype == 'CREDIT_SALE':
            time_part = f"06:00:{sec:02d}.000000+00:00"
        else:
            time_part = f"12:00:{sec:02d}.000000+00:00"
            
        f['created_at'] = f"{tx_date} {time_part}"
        f['updated_at'] = f['created_at']
        
        if ttype == 'CREDIT_SALE':
            running_balance += abs(amt)
            f['amount'] = str(abs(amt))
        elif ttype in ['CASH_PAYMENT', 'ONLINE_PAYMENT', 'GPAY_UPI', 'BANK_TRANSFER', 'CHEQUE']:
            running_balance -= abs(amt)
            f['amount'] = str(-abs(amt))
        elif ttype == 'ADJUSTMENT':
            running_balance += amt
            f['amount'] = str(amt)
        else:
            running_balance += amt
        
        running_balance = running_balance.quantize(Decimal('0.01'))
        f['balance_after'] = str(running_balance)
        total_rechained += 1
    
    c_obj['fields']['current_balance'] = str(running_balance)

print(f"Re-chained {total_rechained} credit transactions across {len(customers)} customers.")

# Save output file
with open(OUTPUT_FILE, 'w') as f:
    json.dump(data, f, indent=2)

print(f"Successfully saved corrected backup to {OUTPUT_FILE}")
