"""inventory/tasks.py — Celery tasks for reorder alerts."""
import logging
from celery import shared_task

logger = logging.getLogger('dairypro')


@shared_task
def check_reorder_levels():
    """Periodic task: find all items below reorder level."""
    from .models import InventoryItem
    from django.db.models import F
    low = InventoryItem.objects.filter(
        quantity_on_hand__lte=F('reorder_level'),
        is_active=True
    )
    for item in low:
        send_reorder_alert.delay(str(item.id))
    return f'Checked {low.count()} low-stock items.'


@shared_task
def send_reorder_alert(item_id):
    from .models import InventoryItem
    from dairypro.core.models import User, Role
    from django.core.mail import send_mail
    from django.conf import settings

    try:
        item = InventoryItem.objects.get(id=item_id)
    except InventoryItem.DoesNotExist:
        return

    managers = User.objects.filter(
        role__in=[Role.SUPER_ADMIN, Role.FARM_MANAGER],
        is_active=True
    )
    body = (f'REORDER ALERT: {item.name} ({item.item_code})\n'
            f'Current stock: {item.quantity_on_hand} {item.unit}\n'
            f'Reorder level: {item.reorder_level} {item.unit}\n'
            f'Suggested reorder quantity: {item.reorder_quantity or "N/A"}')

    for user in managers:
        try:
            send_mail('[DairyPro 360] Reorder Alert', body,
                      settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=True)
        except Exception as e:
            logger.warning('Reorder alert email failed for %s: %s', user.email, e)

    logger.info('Reorder alert sent for %s', item.item_code)
