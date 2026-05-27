"""hr/tasks.py — Payroll calculation Celery task."""
import logging
from decimal import Decimal
from celery import shared_task

logger = logging.getLogger('dairypro')


@shared_task(bind=True, max_retries=3)
def compute_payroll(self, run_id):
    """
    Compute payroll for all active employees for the given PayrollRun.
    FR-E-03: PF=12%, ESI employee=0.75%, ESI employer=3.25%
    BUG-01 fix: use present_days or 0 if no attendance records.
    """
    from .models import PayrollRun, PayrollLine, Employee, AttendanceRecord
    import calendar

    try:
        run = PayrollRun.objects.get(id=run_id)
    except PayrollRun.DoesNotExist:
        logger.error('PayrollRun %s not found.', run_id)
        return

    working_days = len([
        d for d in range(1, calendar.monthrange(run.year, run.month)[1] + 1)
        if calendar.date(run.year, run.month, d).weekday() < 6  # Mon-Sat
    ])

    employees = Employee.objects.filter(is_active=True)
    total_gross = total_pf = total_esi = total_net = Decimal('0')

    for emp in employees:
        # BUG-01: Default to 0 if no attendance records
        present_days = AttendanceRecord.objects.filter(
            employee=emp,
            attendance_date__year=run.year,
            attendance_date__month=run.month,
            status__in=['Present', 'HalfDay'],
        ).count()

        # HalfDay = 0.5
        half_days = AttendanceRecord.objects.filter(
            employee=emp,
            attendance_date__year=run.year,
            attendance_date__month=run.month,
            status='HalfDay',
        ).count()
        effective_days = Decimal(str(present_days)) - Decimal(str(half_days)) * Decimal('0.5')

        earned_basic = (emp.basic_salary * effective_days /
                        Decimal(str(working_days))).quantize(Decimal('0.01'))

        pf_emp = (earned_basic * PayrollLine.PF_RATE).quantize(Decimal('0.01')) \
            if emp.pf_enrolled else Decimal('0')
        pf_emplr = pf_emp if emp.pf_enrolled else Decimal('0')

        gross = earned_basic
        esi_emp = Decimal('0')
        esi_emplr = Decimal('0')
        if emp.esi_enrolled and gross <= PayrollLine.ESI_WAGE_CEILING:
            esi_emp   = (gross * PayrollLine.ESI_EMPLOYEE).quantize(Decimal('0.01'))
            esi_emplr = (gross * PayrollLine.ESI_EMPLOYER).quantize(Decimal('0.01'))

        net = (earned_basic - pf_emp - esi_emp).quantize(Decimal('0.01'))
        # Safety: net cannot go negative
        net = max(net, Decimal('0'))

        PayrollLine.objects.update_or_create(
            run=run, employee=emp,
            defaults={
                'present_days': int(effective_days),
                'working_days': working_days,
                'basic_salary': emp.basic_salary,
                'earned_basic': earned_basic,
                'pf_employee': pf_emp,
                'pf_employer': pf_emplr,
                'esi_employee': esi_emp,
                'esi_employer': esi_emplr,
                'net_pay': net,
            }
        )
        total_gross += gross
        total_pf    += pf_emp
        total_esi   += esi_emp
        total_net   += net

    run.total_gross = total_gross
    run.total_pf    = total_pf
    run.total_esi   = total_esi
    run.total_net   = total_net
    run.save(update_fields=['total_gross', 'total_pf', 'total_esi', 'total_net'])

    logger.info('Payroll computed for %s/%s: %d employees, net total %s',
                run.month, run.year, employees.count(), total_net)
    return f'Payroll computed for {run.month}/{run.year}: {employees.count()} employees.'
