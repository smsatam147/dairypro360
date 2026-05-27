"""
seed_data.py — Populates DairyPro 360 with realistic demo data.
Run via: python manage.py shell < seed_data.py
"""
import django
django.setup()

from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
import random

from dairypro.core.models import User, Role
from dairypro.cattle.models import Cattle, CattleStatus, HealthRecord, Vaccination, BreedingRecord
from dairypro.milk.models import MilkCollection, Shift, QualityGrade
from dairypro.inventory.models import InventoryItem, StockTransaction
from dairypro.sales.models import Customer, SalesOrder, OrderLine, Invoice, InvoiceStatus
from dairypro.hr.models import Employee, AttendanceRecord
from dairypro.finance.models import Account, JournalEntry, JournalLine

today = timezone.now().date()
admin     = User.objects.get(email='admin@dairypro.com')
vet_user  = User.objects.get(email='vet@dairypro.com')
accountant = User.objects.get(email='accountant@dairypro.com')

print("=== Seeding DairyPro 360 Demo Data ===")

# ── 1. CATTLE ─────────────────────────────────────────────────────────────────
print("\n[1/7] Creating cattle...")

cattle_data = [
    ('COW-001', 'Lakshmi',   'Holstein',   CattleStatus.LACTATING, date(2019, 3, 10)),
    ('COW-002', 'Ganga',     'Jersey',     CattleStatus.LACTATING, date(2018, 7, 22)),
    ('COW-003', 'Saraswati', 'Gir',        CattleStatus.LACTATING, date(2020, 1, 5)),
    ('COW-004', 'Kamdhenu',  'Sahiwal',    CattleStatus.LACTATING, date(2019, 11, 14)),
    ('COW-005', 'Nandini',   'Holstein',   CattleStatus.LACTATING, date(2021, 5, 30)),
    ('COW-006', 'Radha',     'Jersey',     CattleStatus.LACTATING, date(2020, 8, 18)),
    ('COW-007', 'Tulsi',     'Crossbreed', CattleStatus.LACTATING, date(2019, 4, 2)),
    ('COW-008', 'Parvati',   'Gir',        CattleStatus.LACTATING, date(2018, 12, 9)),
    ('COW-009', 'Meera',     'Sahiwal',    CattleStatus.DRY,       date(2020, 6, 25)),
    ('COW-010', 'Durga',     'Holstein',   CattleStatus.DRY,       date(2019, 2, 17)),
    ('COW-011', 'Kaveri',    'Jersey',     CattleStatus.PREGNANT,  date(2021, 9, 11)),
    ('COW-012', 'Yamuna',    'Crossbreed', CattleStatus.PREGNANT,  date(2022, 3, 7)),
    ('BULL-001','Nandi',     'Holstein',   CattleStatus.ACTIVE,    date(2017, 6, 15)),
    ('CALF-001','Chotu',     'Jersey',     CattleStatus.ACTIVE,    date(2024, 1, 20)),
    ('CALF-002','Munni',     'Gir',        CattleStatus.ACTIVE,    date(2024, 4, 3)),
]

cattle_objs = []
for tag, name, breed, status, dob in cattle_data:
    c, _ = Cattle.objects.get_or_create(
        tag_number=tag,
        defaults=dict(
            name=name, breed=breed, status=status,
            date_of_birth=dob, is_active=True,
            purchase_date=dob + timedelta(days=30),
            purchase_price=Decimal(random.randint(25000, 85000)),
            created_by=admin
        )
    )
    cattle_objs.append(c)

lactating = [c for c in cattle_objs if c.status == CattleStatus.LACTATING]
print(f"  {len(cattle_objs)} cattle ({len(lactating)} lactating)")

# ── 2. HEALTH RECORDS & VACCINATIONS ─────────────────────────────────────────
print("\n[2/7] Creating health records & vaccinations...")

diagnoses = [
    'Mild fever — prescribed antibiotics',
    'Routine annual checkup — all clear',
    'Minor hoof crack — treated and bandaged',
    'Deworming completed — Ivermectin administered',
    'Mastitis — early stage, treated with antibiotics',
    'Post-calving checkup — healthy',
]
record_types = ['Routine', 'Illness', 'Deworming', 'Injury']
vaccines = [
    ('FMD Vaccine', 180), ('Brucellosis', 365),
    ('HS Vaccine', 180),  ('BQ Vaccine', 365),
]

hr_count = vc_count = 0
for cow in cattle_objs[:10]:
    for i in range(2):
        visit = today - timedelta(days=random.randint(10, 200))
        HealthRecord.objects.get_or_create(
            cattle=cow, visit_date=visit,
            defaults=dict(
                vet=vet_user,
                record_type=random.choice(record_types),
                diagnosis=random.choice(diagnoses),
                treatment='As prescribed by vet',
                cost=Decimal(random.randint(300, 2500))
            )
        )
        hr_count += 1
    for vname, interval in random.sample(vaccines, 2):
        given = today - timedelta(days=random.randint(30, 300))
        Vaccination.objects.get_or_create(
            cattle=cow, vaccine_name=vname,
            defaults=dict(
                vet=vet_user,
                administered_on=given,
                next_due_date=given + timedelta(days=interval),
                batch_number=f'BATCH-{random.randint(1000,9999)}'
            )
        )
        vc_count += 1

for cow in cattle_objs:
    if cow.status == CattleStatus.PREGNANT:
        bd = today - timedelta(days=random.randint(60, 150))
        BreedingRecord.objects.get_or_create(
            cattle=cow, breeding_date=bd,
            defaults=dict(method='AI', semen_batch=f'SB-{random.randint(100,999)}')
        )

print(f"  {hr_count} health records, {vc_count} vaccinations")

# ── 3. MILK COLLECTIONS ───────────────────────────────────────────────────────
print("\n[3/7] Creating 30 days of milk collections...")

base_yields = {
    'COW-001': 18.5, 'COW-002': 15.2, 'COW-003': 12.8,
    'COW-004': 14.1, 'COW-005': 20.3, 'COW-006': 16.7,
    'COW-007': 13.5, 'COW-008': 11.9,
}
milk_count = 0
for day_offset in range(30, 0, -1):
    cdate = today - timedelta(days=day_offset)
    for cow in lactating[:8]:
        base = base_yields.get(cow.tag_number, 14.0)
        for shift in [Shift.MORNING, Shift.EVENING]:
            qty = round(base * (0.55 if shift == Shift.MORNING else 0.45) + random.uniform(-1.5, 1.5), 2)
            fat = round(random.uniform(3.8, 5.2), 2)
            snf = round(random.uniform(8.2, 9.1), 2)
            _, created = MilkCollection.objects.get_or_create(
                cattle=cow, collection_date=cdate, shift=shift,
                defaults=dict(
                    field_worker=admin,
                    quantity_litres=Decimal(str(max(qty, 0.5))),
                    fat_percentage=Decimal(str(fat)),
                    snf_percentage=Decimal(str(snf)),
                )
            )
            if created:
                milk_count += 1

print(f"  {milk_count} milk collection entries")

# ── 4. INVENTORY ──────────────────────────────────────────────────────────────
print("\n[4/7] Creating inventory items...")

items_data = [
    ('ITM-001', 'Cattle Feed - Premium',  'Feed',     'kg',  850,   200, 42.50),
    ('ITM-002', 'Mineral Supplement',     'Feed',     'kg',  120,    30, 180.00),
    ('ITM-003', 'Silage Maize',           'Feed',     'kg', 2500,   500, 8.50),
    ('ITM-004', 'Ivermectin Injection',   'Medicine', 'kg',   48,    10, 95.00),
    ('ITM-005', 'Oxytetracycline',        'Medicine', 'kg',   35,    10, 120.00),
    ('ITM-006', 'Mastitis Treatment',     'Medicine', 'kg',   24,     8, 85.00),
    ('ITM-007', 'Teat Dip Solution',      'Medicine', 'litre',18,     5, 320.00),
    ('ITM-008', 'Milk Testing Kit',       'Equipment','kg',   12,     3, 450.00),
    ('ITM-009', 'Sanitiser - Bulk',       'Medicine', 'litre', 8,     3, 220.00),
    ('ITM-010', 'FMD Vaccine',            'Medicine', 'kg',   55,    15, 65.00),
    ('ITM-011', 'Hay Bales',              'Feed',     'kg',   95,    20, 380.00),
    ('ITM-012', 'Milking Machine Liner',  'Equipment','kg',    6,     4, 1200.00),
]

inv_objs = []
for code, name, cat, unit, qty, reorder, price in items_data:
    obj, _ = InventoryItem.objects.get_or_create(
        item_code=code,
        defaults=dict(
            name=name, category=cat, unit=unit,
            quantity_on_hand=Decimal(str(qty)),
            reorder_level=Decimal(str(reorder)),
            unit_cost=Decimal(str(price)),
            is_active=True
        )
    )
    inv_objs.append(obj)

print(f"  {len(inv_objs)} inventory items")

# ── 5. CUSTOMERS & INVOICES ───────────────────────────────────────────────────
print("\n[5/7] Creating customers & invoices...")

customers_data = [
    ('Sharma Dairy Distributors', 'sharma.dairy@gmail.com', '9876543210', 'Mumbai'),
    ('Patel Milk Co-op',          'patel.milk@gmail.com',   '9823456789', 'Pune'),
    ('Gupta Fresh Foods',         'gupta.fresh@gmail.com',  '9712345678', 'Nashik'),
    ('City Milk Supply',          'citymilk@gmail.com',     '9654321098', 'Aurangabad'),
    ('Green Valley Dairy',        'greenvalley@gmail.com',  '9543210987', 'Kolhapur'),
]

cust_objs = []
for name, email, phone, city in customers_data:
    c, _ = Customer.objects.get_or_create(
        name=name,
        defaults=dict(email=email, phone=phone, address=city,
                      gstin=f'27AABCU{random.randint(1000,9999)}D1Z5')
    )
    cust_objs.append(c)

inv_count = 0
statuses = [InvoiceStatus.PAID, InvoiceStatus.PAID, InvoiceStatus.PAID,
            InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE]

for i in range(15):
    cust = random.choice(cust_objs)
    qty  = Decimal(str(round(random.uniform(200, 800), 2)))
    rate = Decimal(str(round(random.uniform(45, 65), 2)))
    subtotal = (qty * rate).quantize(Decimal('0.01'))
    cgst  = (subtotal * Decimal('0.025')).quantize(Decimal('0.01'))
    sgst  = cgst
    total = subtotal + cgst + sgst
    st    = random.choice(statuses)
    inv_num = f'INV-2026-{100+i:03d}'

    if not Invoice.objects.filter(invoice_number=inv_num).exists():
        # Create a SalesOrder first (required FK)
        order = SalesOrder.objects.create(
            customer=cust,
            status='Delivered',
            total_amount=total,
            created_by=accountant,
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
            status=st,
            created_by=accountant,
        )
        inv_count += 1

print(f"  {len(cust_objs)} customers, {inv_count} invoices")

# ── 6. EMPLOYEES & ATTENDANCE ─────────────────────────────────────────────────
print("\n[6/7] Creating employees & attendance...")

emp_data = [
    ('EMP-001', 'Rajesh Kumar',  'Farm Operations', 'Farm Supervisor',    22000),
    ('EMP-002', 'Sunita Devi',   'Farm Operations', 'Milking Operator',   15000),
    ('EMP-003', 'Mahesh Yadav',  'Farm Operations', 'Cattle Handler',     14500),
    ('EMP-004', 'Priya Sharma',  'Accounts',        'Accounts Executive', 18000),
    ('EMP-005', 'Vikram Singh',  'Farm Operations', 'Feed Manager',       16000),
    ('EMP-006', 'Anita Patel',   'HR',              'HR Executive',       17000),
    ('EMP-007', 'Ravi Gupta',    'Farm Operations', 'Vet Assistant',      15500),
    ('EMP-008', 'Kavita Joshi',  'Accounts',        'Billing Executive',  16500),
]

emp_objs = []
for code, name, dept, desg, salary in emp_data:
    emp, _ = Employee.objects.get_or_create(
        employee_code=code,
        defaults=dict(
            full_name=name, department=dept, designation=desg,
            date_of_joining=today - timedelta(days=random.randint(180, 900)),
            basic_salary=Decimal(str(salary)),
            is_active=True
        )
    )
    emp_objs.append(emp)

att_count = 0
for day_offset in range(15, 0, -1):
    att_date = today - timedelta(days=day_offset)
    if att_date.weekday() < 6:
        for emp in emp_objs:
            roll = random.random()
            if roll > 0.08:
                st = AttendanceRecord.AttendanceStatus.PRESENT
            elif roll > 0.04:
                st = AttendanceRecord.AttendanceStatus.HALFDAY
            else:
                st = AttendanceRecord.AttendanceStatus.ABSENT
            AttendanceRecord.objects.get_or_create(
                employee=emp, attendance_date=att_date,
                defaults=dict(status=st)
            )
            att_count += 1

print(f"  {len(emp_objs)} employees, {att_count} attendance records")

# ── 7. FINANCE ACCOUNTS & JOURNAL ENTRIES ────────────────────────────────────
print("\n[7/7] Creating finance accounts & journal entries...")

accounts_data = [
    ('1001', 'Cash in Hand',          Account.AccountType.ASSET),
    ('1002', 'Bank - SBI Current',    Account.AccountType.ASSET),
    ('1003', 'Accounts Receivable',   Account.AccountType.ASSET),
    ('1101', 'Cattle & Livestock',    Account.AccountType.ASSET),
    ('4001', 'Milk Sales Revenue',    Account.AccountType.REVENUE),
    ('4002', 'Cattle Sales Revenue',  Account.AccountType.REVENUE),
    ('5001', 'Feed & Fodder Expense', Account.AccountType.EXPENSE),
    ('5002', 'Veterinary Expense',    Account.AccountType.EXPENSE),
    ('5003', 'Salary Expense',        Account.AccountType.EXPENSE),
    ('5004', 'Electricity Expense',   Account.AccountType.EXPENSE),
    ('2001', 'Accounts Payable',      Account.AccountType.LIABILITY),
    ('3001', 'Capital Account',       Account.AccountType.EQUITY),
]

acc_objs = {}
for code, name, atype in accounts_data:
    acc, _ = Account.objects.get_or_create(
        account_code=code,
        defaults=dict(account_name=name, account_type=atype, is_active=True)
    )
    acc_objs[code] = acc

je_data = [
    ('JE-2026-001', 'Milk sales receipt - May Week 1', [('1002', 85000, 0), ('4001', 0, 85000)]),
    ('JE-2026-002', 'Milk sales receipt - May Week 2', [('1002', 92000, 0), ('4001', 0, 92000)]),
    ('JE-2026-003', 'Milk sales receipt - May Week 3', [('1002', 88500, 0), ('4001', 0, 88500)]),
    ('JE-2026-004', 'Staff salaries - April',          [('5003', 142000, 0), ('1002', 0, 142000)]),
    ('JE-2026-005', 'Feed purchase - May',             [('5001', 38000, 0),  ('2001', 0, 38000)]),
    ('JE-2026-006', 'Electricity bill - April',        [('5004', 12500, 0),  ('1002', 0, 12500)]),
    ('JE-2026-007', 'Veterinary medicines purchase',   [('5002', 8500, 0),   ('1002', 0, 8500)]),
    ('JE-2026-008', 'Capital contribution',            [('1002', 500000, 0), ('3001', 0, 500000)]),
]

je_count = 0
for je_num, desc, lines in je_data:
    if not JournalEntry.objects.filter(entry_number=je_num).exists():
        je = JournalEntry.objects.create(
            entry_number=je_num,
            entry_date=today - timedelta(days=random.randint(1, 50)),
            description=desc,
            reference_type='Manual',
            created_by=accountant,
        )
        for acc_code, dr, cr in lines:
            JournalLine.objects.create(
                entry=je,
                account=acc_objs[acc_code],
                debit=Decimal(str(dr)),
                credit=Decimal(str(cr)),
            )
        je_count += 1

print(f"  {len(acc_objs)} accounts, {je_count} journal entries")

print("\n✅ All demo data seeded successfully!")
print("   Refresh http://localhost:3000 to see live data!")
