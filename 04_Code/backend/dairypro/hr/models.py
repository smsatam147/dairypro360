"""hr/models.py — Employee, AttendanceRecord, PayrollRun, PayrollLine."""
import uuid
from decimal import Decimal
from django.db import models


class Employee(models.Model):
    class EmploymentType(models.TextChoices):
        PERMANENT = 'Permanent', 'Permanent'
        CONTRACT  = 'Contract',  'Contract'
        DAILY     = 'Daily',     'Daily Wage'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user            = models.OneToOneField('core.User', on_delete=models.SET_NULL,
                                            null=True, blank=True, related_name='employee_profile')
    employee_code   = models.CharField(max_length=20, unique=True)
    full_name       = models.CharField(max_length=255)
    designation     = models.CharField(max_length=100, blank=True)
    employment_type = models.CharField(max_length=15, choices=EmploymentType.choices,
                                        default=EmploymentType.PERMANENT)
    department      = models.CharField(max_length=100, blank=True)
    date_of_joining = models.DateField()
    basic_salary    = models.DecimalField(max_digits=14, decimal_places=2)
    pf_enrolled     = models.BooleanField(default=True)
    esi_enrolled    = models.BooleanField(default=True)
    uan_number      = models.CharField(max_length=20, blank=True)
    esic_number     = models.CharField(max_length=20, blank=True)
    bank_account    = models.CharField(max_length=20, blank=True)
    bank_ifsc       = models.CharField(max_length=11, blank=True)
    is_active       = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'employees'
        ordering = ['full_name']

    def __str__(self):
        return f'{self.employee_code} — {self.full_name}'


class AttendanceRecord(models.Model):
    class AttendanceStatus(models.TextChoices):
        PRESENT = 'Present', 'Present'
        ABSENT  = 'Absent',  'Absent'
        HALFDAY = 'HalfDay', 'Half Day'
        LEAVE   = 'Leave',   'Leave'
        HOLIDAY = 'Holiday', 'Holiday'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee        = models.ForeignKey(Employee, on_delete=models.CASCADE,
                                         related_name='attendance_records')
    attendance_date = models.DateField()
    status          = models.CharField(max_length=10, choices=AttendanceStatus.choices)
    check_in        = models.TimeField(null=True, blank=True)
    check_out       = models.TimeField(null=True, blank=True)
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'attendance_records'
        constraints = [
            models.UniqueConstraint(fields=['employee', 'attendance_date'],
                                     name='uq_attendance')
        ]


class PayrollRun(models.Model):
    class Status(models.TextChoices):
        DRAFT     = 'Draft',     'Draft'
        APPROVED  = 'Approved',  'Approved'
        DISBURSED = 'Disbursed', 'Disbursed'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    month        = models.SmallIntegerField()  # 1-12
    year         = models.SmallIntegerField()
    status       = models.CharField(max_length=15, choices=Status.choices, default=Status.DRAFT)
    total_gross  = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_pf     = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_esi    = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_net    = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    approved_by  = models.ForeignKey('core.User', on_delete=models.SET_NULL,
                                      null=True, blank=True)
    approved_at  = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_runs'
        constraints = [
            models.UniqueConstraint(fields=['month', 'year'], name='uq_payroll_run')
        ]
        ordering = ['-year', '-month']


class PayrollLine(models.Model):
    """
    Payroll formula (FR-E-03):
    earned_basic  = basic_salary * (present_days / working_days)
    pf_employee   = 12% of earned_basic  (EPF Act)
    pf_employer   = 12% of earned_basic
    esi_employee  = 0.75% of gross_pay  (if gross <= 21000)
    esi_employer  = 3.25% of gross_pay
    net_pay       = earned_basic - pf_employee - esi_employee - other_deductions
    """
    PF_RATE          = Decimal('0.12')
    ESI_EMPLOYEE     = Decimal('0.0075')
    ESI_EMPLOYER     = Decimal('0.0325')
    ESI_WAGE_CEILING = Decimal('21000.00')

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run              = models.ForeignKey(PayrollRun, on_delete=models.CASCADE, related_name='lines')
    employee         = models.ForeignKey(Employee, on_delete=models.PROTECT)
    present_days     = models.SmallIntegerField(default=0)
    working_days     = models.SmallIntegerField()
    basic_salary     = models.DecimalField(max_digits=14, decimal_places=2)
    earned_basic     = models.DecimalField(max_digits=14, decimal_places=2)
    pf_employee      = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    pf_employer      = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    esi_employee     = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    esi_employer     = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    other_deductions = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    net_pay          = models.DecimalField(max_digits=14, decimal_places=2)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payroll_lines'
