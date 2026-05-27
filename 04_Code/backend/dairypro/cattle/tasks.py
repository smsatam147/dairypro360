"""cattle/tasks.py — Celery tasks for vaccination & calving alerts."""
import logging
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger('dairypro')


@shared_task
def send_vaccination_alerts():
    """Alert Farm Manager & Vet about vaccinations due in the next 7 days (FR-C-03)."""
    from .models import Vaccination
    from dairypro.core.models import User, Role

    cutoff = timezone.now().date() + timedelta(days=7)
    due = Vaccination.objects.filter(
        next_due_date__lte=cutoff,
        next_due_date__gte=timezone.now().date(),
        cattle__is_active=True,
    ).select_related('cattle', 'vet')

    if not due.exists():
        return 'No vaccinations due.'

    recipients = User.objects.filter(
        role__in=[Role.SUPER_ADMIN, Role.FARM_MANAGER, Role.VET],
        is_active=True
    )

    from django.core.mail import send_mail
    from django.conf import settings

    body_lines = [f'- {v.cattle.tag_number}: {v.vaccine_name} due on {v.next_due_date}'
                  for v in due]
    body = 'Vaccinations due in the next 7 days:\n\n' + '\n'.join(body_lines)

    for user in recipients:
        try:
            send_mail(
                subject='[DairyPro 360] Vaccination Due Alerts',
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception as e:
            logger.warning('Failed to send vaccination alert to %s: %s', user.email, e)

    logger.info('Vaccination alerts sent for %d records.', due.count())
    return f'Sent alerts for {due.count()} vaccinations.'


@shared_task
def send_calving_alerts():
    """Alert Farm Manager about expected calvings in next 14 days (FR-C-06)."""
    from .models import BreedingRecord
    from dairypro.core.models import User, Role

    cutoff = timezone.now().date() + timedelta(days=14)
    due = BreedingRecord.objects.filter(
        expected_calving__lte=cutoff,
        expected_calving__gte=timezone.now().date(),
        calving_status__isnull=True,
        cattle__is_active=True,
    ).select_related('cattle')

    if not due.exists():
        return 'No calvings due.'

    recipients = User.objects.filter(
        role__in=[Role.SUPER_ADMIN, Role.FARM_MANAGER],
        is_active=True
    )

    from django.core.mail import send_mail
    from django.conf import settings

    body_lines = [f'- {br.cattle.tag_number}: expected calving on {br.expected_calving}'
                  for br in due]
    body = 'Expected calvings in the next 14 days:\n\n' + '\n'.join(body_lines)

    for user in recipients:
        try:
            send_mail(
                subject='[DairyPro 360] Calving Due Alerts',
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        except Exception as e:
            logger.warning('Failed to send calving alert to %s: %s', user.email, e)

    return f'Sent calving alerts for {due.count()} records.'
