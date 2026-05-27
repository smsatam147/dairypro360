"""inventory/models.py — InventoryItem, StockTransaction"""
import uuid
from django.db import models


class InventoryItem(models.Model):
    class Category(models.TextChoices):
        FEED      = 'Feed',      'Feed & Fodder'
        MEDICINE  = 'Medicine',  'Medicine & Supplements'
        EQUIPMENT = 'Equipment', 'Equipment'
        PACKAGING = 'Packaging', 'Packaging'
        CHEMICALS = 'Chemicals', 'Chemicals & Disinfectants'
        OTHER     = 'Other',     'Other'

    class Unit(models.TextChoices):
        KG     = 'kg',     'Kilogram'
        LITRE  = 'litre',  'Litre'
        UNIT   = 'unit',   'Unit'
        BOX    = 'box',    'Box'
        BAG    = 'bag',    'Bag'
        BOTTLE = 'bottle', 'Bottle'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item_code        = models.CharField(max_length=50, unique=True)
    name             = models.CharField(max_length=255)
    category         = models.CharField(max_length=20, choices=Category.choices)
    unit             = models.CharField(max_length=10, choices=Unit.choices)
    quantity_on_hand = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    reorder_level    = models.DecimalField(max_digits=14, decimal_places=3, default=0)
    reorder_quantity = models.DecimalField(max_digits=14, decimal_places=3, null=True, blank=True)
    unit_cost        = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    supplier_name    = models.CharField(max_length=255, blank=True)
    supplier_contact = models.CharField(max_length=100, blank=True)
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventory_items'
        ordering = ['category', 'name']

    def __str__(self):
        return f'{self.item_code} — {self.name} ({self.quantity_on_hand} {self.unit})'

    @property
    def is_low_stock(self):
        return self.quantity_on_hand <= self.reorder_level


class StockTransaction(models.Model):
    class TxnType(models.TextChoices):
        PURCHASE    = 'Purchase',    'Purchase'
        CONSUMPTION = 'Consumption', 'Consumption'
        ADJUSTMENT  = 'Adjustment',  'Adjustment'
        RETURN      = 'Return',      'Return'
        WASTAGE     = 'Wastage',     'Wastage'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item         = models.ForeignKey(InventoryItem, on_delete=models.PROTECT,
                                      related_name='transactions')
    txn_type     = models.CharField(max_length=15, choices=TxnType.choices)
    quantity     = models.DecimalField(max_digits=14, decimal_places=3)  # +in, -out
    unit_cost    = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    reference_no = models.CharField(max_length=100, blank=True)
    notes        = models.TextField(blank=True)
    performed_by = models.ForeignKey('core.User', on_delete=models.SET_NULL,
                                      null=True, related_name='stock_transactions')
    txn_date     = models.DateField(auto_now_add=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'stock_transactions'
        ordering = ['-created_at']
