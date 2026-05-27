"""sales/models.py — Customer, SalesOrder, OrderLine, Invoice, Delivery, Payment."""
import uuid
from django.db import models


class Customer(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name           = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=255, blank=True)
    phone          = models.CharField(max_length=20, blank=True)
    email          = models.EmailField(blank=True)
    address        = models.TextField(blank=True)
    gstin          = models.CharField(max_length=15, blank=True)
    state_code     = models.CharField(max_length=2, blank=True)
    is_active      = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers'
        ordering = ['name']


class OrderStatus(models.TextChoices):
    DRAFT       = 'Draft',       'Draft'
    CONFIRMED   = 'Confirmed',   'Confirmed'
    DISPATCHED  = 'Dispatched',  'Dispatched'
    DELIVERED   = 'Delivered',   'Delivered'
    CANCELLED   = 'Cancelled',   'Cancelled'


class SalesOrder(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer     = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name='orders')
    order_date   = models.DateField(auto_now_add=True)
    status       = models.CharField(max_length=15, choices=OrderStatus.choices,
                                     default=OrderStatus.DRAFT)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes        = models.TextField(blank=True)
    created_by   = models.ForeignKey('core.User', on_delete=models.SET_NULL,
                                      null=True, related_name='sales_orders')
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sales_orders'
        ordering = ['-created_at']


class OrderLine(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order       = models.ForeignKey(SalesOrder, on_delete=models.CASCADE, related_name='lines')
    item        = models.ForeignKey('inventory.InventoryItem', on_delete=models.PROTECT)
    quantity    = models.DecimalField(max_digits=14, decimal_places=3)
    unit_price  = models.DecimalField(max_digits=14, decimal_places=2)
    discount_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    line_total  = models.DecimalField(max_digits=14, decimal_places=2)

    class Meta:
        db_table = 'order_lines'


class InvoiceStatus(models.TextChoices):
    DRAFT            = 'Draft',            'Draft'
    ISSUED           = 'Issued',           'Issued'
    PAID             = 'Paid',             'Paid'
    PARTIALLY_PAID   = 'PartiallyPaid',    'Partially Paid'
    OVERDUE          = 'Overdue',          'Overdue'
    CANCELLED        = 'Cancelled',        'Cancelled'


class Invoice(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=30, unique=True)  # INV-YYYY-MMDD-NNNN
    order          = models.ForeignKey(SalesOrder, on_delete=models.PROTECT)
    customer       = models.ForeignKey(Customer, on_delete=models.PROTECT)
    invoice_date   = models.DateField(auto_now_add=True)
    due_date       = models.DateField()
    subtotal       = models.DecimalField(max_digits=14, decimal_places=2)
    hsn_code       = models.CharField(max_length=4, default='0402')
    cgst_rate      = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sgst_rate      = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    igst_rate      = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    cgst_amount    = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    sgst_amount    = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    igst_amount    = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_amount   = models.DecimalField(max_digits=14, decimal_places=2)
    status         = models.CharField(max_length=20, choices=InvoiceStatus.choices,
                                       default=InvoiceStatus.DRAFT)
    notes          = models.TextField(blank=True)
    created_by     = models.ForeignKey('core.User', on_delete=models.SET_NULL,
                                        null=True, related_name='invoices_created')
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'invoices'
        ordering = ['-invoice_date']

    def clean(self):
        from django.core.exceptions import ValidationError
        # BUG-04 fix: Tax exclusivity — IGST and CGST/SGST are mutually exclusive
        if self.igst_amount > 0 and (self.cgst_amount > 0 or self.sgst_amount > 0):
            raise ValidationError(
                'GST Error: IGST (interstate) and CGST/SGST (intrastate) cannot both be applied. '
                'Use CGST+SGST for intrastate, IGST for interstate.'
            )


class DeliveryStatus(models.TextChoices):
    SCHEDULED  = 'Scheduled',  'Scheduled'
    IN_TRANSIT = 'InTransit',  'In Transit'
    DELIVERED  = 'Delivered',  'Delivered'
    FAILED     = 'Failed',     'Failed'


class Delivery(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order          = models.OneToOneField(SalesOrder, on_delete=models.CASCADE,
                                           related_name='delivery')
    delivery_date  = models.DateField(null=True, blank=True)
    driver         = models.ForeignKey('core.User', on_delete=models.SET_NULL,
                                        null=True, blank=True)
    otp_hash       = models.TextField(blank=True)  # bcrypt hash of 6-digit OTP
    otp_used       = models.BooleanField(default=False)
    status         = models.CharField(max_length=15, choices=DeliveryStatus.choices,
                                       default=DeliveryStatus.SCHEDULED)
    delivery_notes = models.TextField(blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'deliveries'
