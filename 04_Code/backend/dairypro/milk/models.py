"""milk/models.py — MilkCollection, QualityRecord, YieldAlert"""
import uuid
from django.db import models


class Shift(models.TextChoices):
    MORNING = 'Morning', 'Morning'
    EVENING = 'Evening', 'Evening'


class QualityGrade(models.TextChoices):
    A        = 'A',        'Grade A'
    B        = 'B',        'Grade B'
    C        = 'C',        'Grade C'
    REJECTED = 'Rejected', 'Rejected'


def compute_quality_grade(fat_pct, snf_pct):
    """Grade based on fat% and SNF% thresholds (FR-M-02)."""
    if fat_pct is None or snf_pct is None:
        return None
    if fat_pct >= 3.5 and snf_pct >= 8.5:
        return QualityGrade.A
    if fat_pct >= 3.0 and snf_pct >= 8.0:
        return QualityGrade.B
    if fat_pct >= 2.5:
        return QualityGrade.C
    return QualityGrade.REJECTED


class MilkCollection(models.Model):
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cattle              = models.ForeignKey('cattle.Cattle', on_delete=models.PROTECT,
                                             related_name='milk_collections')
    field_worker        = models.ForeignKey('core.User', on_delete=models.SET_NULL,
                                             null=True, related_name='milk_collections')
    collection_date     = models.DateField()
    shift               = models.CharField(max_length=10, choices=Shift.choices)
    quantity_litres     = models.DecimalField(max_digits=8, decimal_places=2)
    fat_percentage      = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    snf_percentage      = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    quality_grade       = models.CharField(max_length=10, choices=QualityGrade.choices,
                                            null=True, blank=True)
    temperature_celsius = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    is_synced           = models.BooleanField(default=True)  # False = offline entry
    notes               = models.TextField(blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'milk_collections'
        # FR-M-01: Prevent duplicate entry per cow per shift per day (BUG-02 fix)
        constraints = [
            models.UniqueConstraint(
                fields=['cattle', 'collection_date', 'shift'],
                name='uq_milk_collection'
            )
        ]
        indexes = [
            models.Index(fields=['collection_date']),
            models.Index(fields=['cattle']),
        ]

    def save(self, *args, **kwargs):
        # Auto-compute quality grade
        if self.fat_percentage is not None and self.snf_percentage is not None:
            self.quality_grade = compute_quality_grade(
                float(self.fat_percentage), float(self.snf_percentage)
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.cattle.tag_number} {self.collection_date} {self.shift}: {self.quantity_litres}L'


class YieldAlert(models.Model):
    class AlertStatus(models.TextChoices):
        OPEN         = 'Open',         'Open'
        ACKNOWLEDGED = 'Acknowledged', 'Acknowledged'
        RESOLVED     = 'Resolved',     'Resolved'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cattle           = models.ForeignKey('cattle.Cattle', on_delete=models.CASCADE,
                                          related_name='yield_alerts')
    alert_date       = models.DateField()
    expected_yield   = models.DecimalField(max_digits=8, decimal_places=2)
    actual_yield     = models.DecimalField(max_digits=8, decimal_places=2)
    deviation_pct    = models.DecimalField(max_digits=5, decimal_places=2)
    status           = models.CharField(max_length=15, choices=AlertStatus.choices,
                                         default=AlertStatus.OPEN)
    acknowledged_by  = models.ForeignKey('core.User', on_delete=models.SET_NULL,
                                          null=True, blank=True)
    acknowledged_at  = models.DateTimeField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'yield_alerts'
        ordering = ['-created_at']
