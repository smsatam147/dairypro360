"""Celery application for DairyPro 360 async tasks."""
import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dairypro.settings')

app = Celery('dairypro')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# ── Celery Beat Scheduled Tasks ───────────────────────────────────────────────
app.conf.beat_schedule = {
    # Daily nightly digest at 07:00 IST
    'nightly-digest-email': {
        'task': 'dairypro.reports.tasks.send_nightly_digest',
        'schedule': crontab(hour=7, minute=0),
    },
    # DB backup at 02:00 IST
    'nightly-db-backup': {
        'task': 'dairypro.reports.tasks.backup_database',
        'schedule': crontab(hour=2, minute=0),
    },
    # Reorder alerts check every 4 hours
    'reorder-alert-check': {
        'task': 'dairypro.inventory.tasks.check_reorder_levels',
        'schedule': crontab(minute=0, hour='*/4'),
    },
    # Vaccination due alerts every morning at 08:00
    'vaccination-due-alerts': {
        'task': 'dairypro.cattle.tasks.send_vaccination_alerts',
        'schedule': crontab(hour=8, minute=0),
    },
    # Calving alerts check every morning at 08:30
    'calving-alerts': {
        'task': 'dairypro.cattle.tasks.send_calving_alerts',
        'schedule': crontab(hour=8, minute=30),
    },
}
