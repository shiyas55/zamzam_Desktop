from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from apps.products.models import Product
from .models import Customer, CustomerProductPrice

def get_effective_product_price(customer, product):
    """
    Determines effective selling price for a customer and product:
    1. Checks active CustomerProductPrice for this (customer, product) valid today.
    2. Falls back to product.unit_price if no custom price exists.
    Returns: (price: Decimal, is_custom: bool, price_record_id: Optional[str])
    """
    today = timezone.localdate()
    from django.db.models import Q
    custom_price_obj = CustomerProductPrice.objects.filter(
        customer=customer,
        product=product,
        is_active=True,
        effective_from__lte=today,
    ).filter(
        Q(effective_to__isnull=True) | Q(effective_to__gte=today)
    ).order_by("-effective_from", "-created_at").first()

    if custom_price_obj and custom_price_obj.price > Decimal("0.00"):
        return custom_price_obj.price, True, str(custom_price_obj.id)
    return product.unit_price, False, None


def set_customer_product_price(customer=None, product=None, price=None, effective_from=None, effective_to=None, user=None, customer_id=None, product_id=None):
    """
    Configures or updates customer-specific wholesale price for a product.
    Deactivates any previous active price for this customer+product.
    If price is 0, deactivates custom pricing so it falls back to standard product price.
    """
    if customer is None and customer_id is not None:
        customer = customer_id
    if product is None and product_id is not None:
        product = product_id

    price = Decimal(str(price)).quantize(Decimal("0.01"))
    if price < Decimal("0.00"):
        raise ValueError("Price cannot be negative.")

    if effective_from is None:
        effective_from = timezone.localdate()

    with transaction.atomic():
        cust_obj = customer if isinstance(customer, Customer) else Customer.objects.get(id=customer)
        prod_obj = product if isinstance(product, Product) else Product.objects.get(id=product)

        # Find previous active price for audit log comparison
        prev_price_obj = CustomerProductPrice.objects.filter(
            customer=cust_obj,
            product=prod_obj,
            is_active=True
        ).first()
        old_price_val = str(prev_price_obj.price) if prev_price_obj else str(prod_obj.unit_price)

        # Deactivate existing active prices for this customer & product
        CustomerProductPrice.objects.filter(
            customer=cust_obj,
            product=prod_obj,
            is_active=True
        ).update(is_active=False, updated_by=user)

        if price == Decimal("0.00"):
            # Setting price to 0 clears/resets custom rate back to standard base price
            return None

        # Create new active price
        new_price = CustomerProductPrice.objects.create(
            customer=cust_obj,
            product=prod_obj,
            price=price,
            effective_from=effective_from,
            effective_to=effective_to,
            is_active=True,
            created_by=user,
            updated_by=user,
        )

        from apps.common.audit import log_activity
        log_activity(
            user=user,
            action="UPDATED" if prev_price_obj else "CREATED",
            entity_type="PRICE",
            entity_id=new_price.id,
            entity_name=f"{cust_obj.name} - {prod_obj.name}",
            summary=f"Changed {cust_obj.name}'s {prod_obj.name} price: ₹{old_price_val} → ₹{new_price.price}",
            details={
                "customer": cust_obj.name,
                "product": prod_obj.name,
                "old_price": old_price_val,
                "new_price": str(new_price.price),
            },
        )

    return new_price


def get_customers_opening_balances_for_date(target_date, customer_ids=None):
    """
    Computes opening receivable due for customers at the START of target_date
    (i.e. the balance owed BEFORE that day's orders, payments, and adjustments).

    Forward Chronological Carryover Principle:
        Opening Balance on Date D =
            Customer Initial Balance (at first order/registration)
            + Sum(Orders where order_date < D and status != CANCELLED)
            - Sum(Completed Payments where received_at__date < D)
            + Sum(Standalone Credit Adjustments where created_at__date < D
                  occurring strictly after first order date)

    If an explicit Fast Wholesale Entry adjustment exists on Date D, it overrides
    as the authoritative opening balance for that business day.

    Returns: dict { str(customer_id): str(opening_balance_decimal_formatted) }
    """
    import datetime
    import re
    from decimal import Decimal
    from django.db.models import Sum
    from apps.orders.models import Order
    from apps.payments.models import Payment
    from apps.credits.models import CreditTransaction

    if isinstance(target_date, str):
        target_date = datetime.date.fromisoformat(str(target_date).strip()[:10])

    customers_qs = Customer.objects.filter(is_active=True)
    if customer_ids:
        customers_qs = customers_qs.filter(id__in=customer_ids)

    customers = list(customers_qs.values("id", "name"))
    cust_ids = [c["id"] for c in customers]
    if not cust_ids:
        return {}

    # 1. Check for explicit Fast Wholesale Entry adjustment set on target_date
    target_adjs = {}
    target_adj_qs = CreditTransaction.objects.filter(
        customer_id__in=cust_ids,
        transaction_type=CreditTransaction.TransactionType.ADJUSTMENT,
        reference_order__isnull=True,
        created_at__date=target_date,
    ).order_by("created_at")
    for adj in target_adj_qs:
        target_adjs[adj.customer_id] = adj

    # 2. Find earliest order for each customer to determine initial starting balance
    earliest_orders = {}
    for o in (
        Order.objects.filter(customer_id__in=cust_ids)
        .exclude(status=Order.Status.CANCELLED)
        .order_by("order_date", "created_at")
        .prefetch_related("credit_ledger_entries")
    ):
        if o.customer_id not in earliest_orders:
            earliest_orders[o.customer_id] = o

    initial_balances = {}
    first_order_dates = {}
    for cid in cust_ids:
        eo = earliest_orders.get(cid)
        if eo:
            first_order_dates[cid] = eo.order_date
            cs = next(
                (tx for tx in eo.credit_ledger_entries.all() if tx.transaction_type == "CREDIT_SALE"),
                None,
            )
            if cs:
                if cs.balance_before is not None:
                    initial_balances[cid] = cs.balance_before
                elif cs.balance_after is not None:
                    initial_balances[cid] = cs.balance_after - cs.amount

    # 3. Sum of non-cancelled orders prior to target_date
    orders_agg = (
        Order.objects.filter(customer_id__in=cust_ids, order_date__lt=target_date)
        .exclude(status=Order.Status.CANCELLED)
        .values("customer_id")
        .annotate(total=Sum("total_amount"))
    )
    orders_by_cust = {row["customer_id"]: row["total"] for row in orders_agg}

    # 4. Sum of completed payments prior to target_date
    payments_agg = (
        Payment.objects.filter(
            customer_id__in=cust_ids,
            status=Payment.Status.COMPLETED,
            received_at__date__lt=target_date,
        )
        .values("customer_id")
        .annotate(total=Sum("amount"))
    )
    payments_by_cust = {row["customer_id"]: row["total"] for row in payments_agg}

    # 5. Sum of standalone adjustments strictly after first order date and before target_date
    adjs_qs = CreditTransaction.objects.filter(
        customer_id__in=cust_ids,
        transaction_type=CreditTransaction.TransactionType.ADJUSTMENT,
        reference_order__isnull=True,
        created_at__date__lt=target_date,
    ).values("customer_id", "created_at", "amount")
    adjs_by_cust = {}
    for row in adjs_qs:
        cid = row["customer_id"]
        f_date = first_order_dates.get(cid)
        adj_date = row["created_at"].date()
        if f_date is None or adj_date > f_date:
            adjs_by_cust[cid] = adjs_by_cust.get(cid, Decimal("0.00")) + row["amount"]

    results = {}
    for c in customers:
        cid = c["id"]
        cid_str = str(cid)

        # Explicit adjustment takes first priority
        if cid in target_adjs:
            adj = target_adjs[cid]
            m = re.search(r"set to ₹?([\d\.]+)", adj.notes or "")
            if m:
                results[cid_str] = str(Decimal(m.group(1)).quantize(Decimal("0.01")))
                continue
            elif adj.balance_after is not None:
                results[cid_str] = str(Decimal(adj.balance_after).quantize(Decimal("0.01")))
                continue

        f_date = first_order_dates.get(cid)
        # If target_date is exactly the first order day, opening is the initial recorded balance
        if f_date and f_date == target_date:
            init_bal = initial_balances.get(cid, Decimal("0.00"))
            results[cid_str] = str(init_bal.quantize(Decimal("0.01")))
            continue

        # If target_date is strictly before the first order ever existed, balance is 0.00
        if f_date and f_date > target_date:
            results[cid_str] = "0.00"
            continue

        init_bal = initial_balances.get(cid, Decimal("0.00"))
        orders_sum = orders_by_cust.get(cid, Decimal("0.00"))
        payments_sum = payments_by_cust.get(cid, Decimal("0.00"))
        adjs_sum = adjs_by_cust.get(cid, Decimal("0.00"))

        opening = init_bal + orders_sum - payments_sum + adjs_sum
        if opening < Decimal("0.00"):
            opening = Decimal("0.00")
        results[cid_str] = str(opening.quantize(Decimal("0.01")))

    return results

