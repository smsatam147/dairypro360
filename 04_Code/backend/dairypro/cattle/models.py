"""cattle/models.py — Cattle, HealthRecord, Vaccination, BreedingRecord"""
import uuid
from django.db import models
from django.utils import timezone
from datetime import timedelta


class CattleStatus(models.TextChoices):
    ACTIVE    = 'Active',    'Active'
    LACTATING = 'Lactating', 'Lactating'
    DRY       = 'Dry',       'Dry'
    PREGNANT  = 'Pregnant',  'Pregnant'
    SOLD      = 'Sold',      'Sold'
    DECEASED  = 'Deceased',  'Deceased'


class CattleBreed(models.TextChoices):
    HOLSTEIN   = 'Holstein',   'Holstein'
    JERSEY     = 'Jersey',     'Jersey'
    GIR        = 'Gir',        'Gir'
    SAHIWAL    = 'Sahiwal',    'Sahiwal'
    MURRAH     = 'Murrah',     'Murrah (Buffalo)'
    CROSSBREED = 'Crossbreed', 'Crossbreed'
    OTHER      = 'Other',      'Other'


class Cattle(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tag_number     = models.CharField(max_length=50, unique=True)
    name           = models.CharField(max_length=100, blank=True)
    breed          = models.CharField(max_length=20, choices=CattleBreed.choices)
    date_of_birth  = models.DateField()
    status         = models.CharField(max_length=20, choices=CattleStatus.choices,
                                      default=CattleStatus.ACTIVE)
    purchase_date  = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=14, decimal_places=2,
                                         null=True, blank=True)
    notes          = models.TextField(blank=True)
    is_active      = models.BooleanField(default=True)
    deleted_at     = models.DateTimeField(null=True, blank=True)
    created_by     = models.ForeignKey('core.User', on_delete=models.SET_NULL,
                                        null=True, related_name='cattle_created')
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cattle'
        ordering = ['tag_number']
        indexes  = [
            models.Index(fields=['status'], condition=models.Q(is_active=True),
                         name='idx_cattle_status_active'),
        ]

    def __str__(self):
        return f'{self.tag_number} — {self.name or "Unnamed"} ({self.status})'

    @property
    def age_months(self):
        delta = timezone.now().date() - self.date_of_birth
        return delta.days // 30


class HealthRecord(models.Model):
    class RecordType(models.TextChoices):
        ROUTINE    = 'Routine',    'Routine Checkup'
        ILLNESS    = 'Illness',    'Illness'
        INJURY     = 'Injury',     'Injury'
        CALVING    = 'Calving',    'Calving'
        DEWORMING  = 'Deworming',  'Deworming'

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cattle        = models.ForeignKey(Cattle, on_delete=models.CASCADE, related_name='health_records')
    vet           = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True,
                                       related_name='health_records_attended')
    record_type   = models.CharField(max_length=20, choices=RecordType.choices)
    visit_date    = models.DateField()
    diagnosis     = models.TextField(blank=True)
    treatment     = models.TextField(blank=True)
    medicines_given = models.TextField(blank=True)
    follow_up_date  = models.DateField(null=True, blank=True)
    cost          = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'health_records'
        ordering = ['-visit_date']


class Vaccination(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cattle          = models.ForeignKey(Cattle, on_delete=models.CASCADE, related_name='vaccinations')
    vet             = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True,
                                         related_name='vaccinations_administered')
    vaccine_name    = models.CharField(max_length=200)
    administered_on = models.DateField()
    next_due_date   = models.DateField()
    batch_number    = models.CharField(max_length=100, blank=True)
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vaccinations'
        ordering = ['next_due_date']
        indexes  = [models.Index(fields=['next_due_date'])]


class BreedingRecord(models.Model):
    class BreedingMethod(models.TextChoices):
        NATURAL = 'Natural', 'Natural'
        AI      = 'AI',      'Artificial Insemination'

    class CalvingStatus(models.TextChoices):
        PENDING     = 'Pending',    'Pending'
        SUCCESSFUL  = 'Successful', 'Successful'
        FAILED      = 'Failed',     'Failed'
        STILLBIRTH  = 'Stillbirth', 'Stillbirth'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cattle           = models.ForeignKey(Cattle, on_delete=models.CASCADE, related_name='breeding_records')
    breeding_date    = models.DateField()
    method           = models.CharField(max_length=10, choices=BreedingMethod.choices)
    bull             = models.ForeignKey(Cattle, on_delete=models.SET_NULL, null=True, blank=True,
                                          related_name='sired')
    semen_batch      = models.CharField(max_length=100, blank=True)
    expected_calving = models.DateField(null=True, blank=True)  # breeding_date + 280 days
    actual_calving   = models.DateField(null=True, blank=True)
    calving_status   = models.CharField(max_length=15, choices=CalvingStatus.choices,
                                         null=True, blank=True)
    calf_tag_number  = models.CharField(max_length=50, blank=True)
    notes            = models.TextField(blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'breeding_records'
        ordering = ['-breeding_date']

    def save(self, *args, **kwargs):
        # Auto-compute expected calving: gestation = 280 days (FR-C-05)
        if self.breeding_date and not self.expected_calving:
            self.expected_calving = self.breeding_date + timedelta(days=280)
        super().save(*args, **kwargs)
