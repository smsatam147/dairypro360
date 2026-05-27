"""finance/models.py — Chart of Accounts, JournalEntry, JournalLine (double-entry)."""
import uuid
from django.db import models


class Account(models.Model):
    class AccountType(models.TextChoices):
        ASSET     = 'Asset',     'Asset'
        LIABILITY = 'Liability', 'Liability'
        EQUITY    = 'Equity',    'Equity'
        REVENUE   = 'Revenue',   'Revenue'
        EXPENSE   = 'Expense',   'Expense'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account_code = models.CharField(max_length=10, unique=True)
    account_name = models.CharField(max_length=255)
    account_type = models.CharField(max_length=15, choices=AccountType.choices)
    parent       = models.ForeignKey('self', on_delete=models.SET_NULL,
                                      null=True, blank=True, related_name='children')
    is_active    = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'accounts'
        ordering = ['account_code']

    def __str__(self):
        return f'{self.account_code} — {self.account_name}'


class JournalEntry(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entry_number   = models.CharField(max_length=20, unique=True)  # JE-YYYY-NNNN
    entry_date     = models.DateField()
    description    = models.TextField()
    reference_type = models.CharField(max_length=50, blank=True)  # 'Invoice','PayrollRun','Manual'
    reference_id   = models.UUIDField(null=True, blank=True)
    created_by     = models.ForeignKey('core.User', on_delete=models.SET_NULL,
                                        null=True, related_name='journal_entries')
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'journal_entries'
        ordering = ['-entry_date', '-created_at']

    def __str__(self):
        return f'{self.entry_number} — {self.description[:50]}'


class JournalLine(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entry      = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account    = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='journal_lines')
    debit      = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    credit     = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes      = models.TextField(blank=True)

    class Meta:
        db_table = 'journal_lines'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.debit > 0 and self.credit > 0:
            raise ValidationError('A journal line cannot have both debit and credit amounts.')
        if self.debit < 0 or self.credit < 0:
            raise ValidationError('Debit and credit values must be non-negative.')
