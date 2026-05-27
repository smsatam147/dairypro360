"""seed_invoices.py — Creates invoices + today's milk entries for dashboard demo."""
import django
django.setup()

from django.utils import timezone
from datetime import timedelta
from decimal import Decimal
import random

from dairypro.core.models import User
from dairypro.milk.models import MilkCollection, Shift
from dairypro.cattle.models import Cattle, CattleStatus
from dairypro.sales.models import Customer, SalesOrder, Invoice, InvoiceStatus

today    = timezone.now().date()
admin    = User.objects.get(email='admin@dairypro.com')
acct     = User.objects.get(email='accountant@dairypro.com')

# ── TODAY'S MILK ──────────────────────────────────────────────────────────────
print("[1] Adding today's milk entries...")
base_yields = {
    'COW-001': 18.5, 'COW-002': 15.2, 'COW-003': 12.8,
    'COW-004': 14.1, 'COW-005': 20.3, 'COW-006': 16.7,
    'COW-007': 13.5, 'COW-008': 11.9,
}
milk_count = 0
for tag, base in base_yields.items():
    try:
        cow = Cattle.objects.get(tag_number=tag)
    except Cattle.DoesNotExist:
        continue
    for shift in [Shift.MORNING, Shift.EVENING]:
        qty = round(base * (0.55 if shift == Shift.MORNING else 0.45) + random.uniform(-1, 1), 2)
        fat = round(random.uniform(3.8, 5.2), 2)
        snf = round(random.uniform(8.2, 9.1), 2)
        obj, created = MilkCollection.objects.get_or_create(
            cattle=cow, collection_date=today, shift=shift,
            defaults=dict(
                field_worker=admin,
                quantity_litres=Decimal(str(max(qty, 0.5))),
                fat_percentage=Decimal(str(fat)),
                snf_percentage=Decimal(str(snf)),
            )
        )
        if created:
            milk_count += 1

print(f"   Added {milk_count} milk entries for today")

# ── CUSTOMERS ─────────────────────────────────────────────────────────────────
print("[2] Creating customers...")
customers_data = [
    ('Sharma Dairy Distributors', 'sharma.dairy@gmail.com', '9876543210', 'Mumbai'),
    ('Patel Milk Co-op',          'patel.milk@gmail.com',   '9823456789', 'Pune'),
    ('Gupta Fresh Foods',         'gupta.fresh@gmail.com',  '9712345678', 'Nashik'),
    ('City Milk Supply',          'citymilk@gmail.com',     '9654321098', 'Aurangabad'),
    ('Green Valley Dairy',        'greenvalley@gmail.com',  '9543210987', 'Kolhapur'),
]
cust_objs = []
for name, email, phone, city in customers_data:
    c, _ = Customer.objects.get_or_create(name=name, defaults=dict(email=email, phone=phone, address=city))
    cust_objs.append(c)
print(f"   {len(cust_objs)} customers ready")

# ── INVOICES ──────────────────────────────────────────────────────────────────
print("[3] Creating invoices...")
statuses = [
    InvoiceStatus.PAID, InvoiceStatus.PAID, InvoiceStatus.PAID,
    InvoiceStatus.PAID, InvoiceStatus.PAID,
    InvoiceStatus.ISSUED, InvoiceStatus.ISSUED,
    InvoiceStatus.OVERDUE, InvoiceStatus.OVERDUE,
]

inv_count = 0
for i in range(15):
    inv_num = f'INV-2026-{200+i:03d}'
    if Invoice.objects.filter(invoice_number=inv_num).exists():
        continue
    try:
        cust     = random.choice(cust_objs)
        qty      = Decimal(str(round(random.uniform(200, 800), 2)))
        rate     = Decimal(str(round(random.uniform(45, 65), 2)))
        subtotal = (qty * rate).quantize(Decimal('0.01'))
        cgst     = (subtotal * Decimal('0.025')).quantize(Decimal('0.01'))
        sgst     = cgst
        total    = subtotal + cgst + sgst
        status   = random.choice(statuses)

        order = SalesOrder.objects.create(
            customer=cust,
            status='Delivered',
            total_amount=total,
            created_by=acct,
        )
        Invoice.objects.create(
            invoice_number=inv_num,
            order=order,
            customer=cust,
            due_date=today + timedelta(days=30),
            subtotal=subtotal,
            cgst_amount=cgst,
            sgst_amount=sgst,
            total_amount=total,
            status=status,
            created_by=acct,
        )
        inv_count += 1
        print(f"   {inv_num} — {status} — ₹{total:.0f}")
    except Exception as e:
        print(f"   ERROR on invoice {i}: {e}")

print(f"\n✅ Done! Created {inv_count} invoices")
print(f"   Total invoices in DB: {Invoice.objects.count()}")
print(f"   Paid: {Invoice.objects.filter(status=InvoiceStatus.PAID).count()}")
print(f"   Issued: {Invoice.objects.filter(status=InvoiceStatus.ISSUED).count()}")
print(f"   Overdue: {Invoice.objects.filter(status=InvoiceStatus.OVERDUE).count()}")
