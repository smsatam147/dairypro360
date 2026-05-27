"""reports/views.py — Dashboard KPIs, Audit Log."""
import logging
from decimal import Decimal
from django.utils import timezone
from django.core.cache import cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

from dairypro.core.permissions import IsAnyAuthenticated
from dairypro.core.utils import success_response

logger = logging.getLogger('dairypro')

CACHE_TTL = 60  # seconds


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAnyAuthenticated])
def dashboard_kpis(request):
    """GET /api/v1/reports/dashboard/ — Cached 60s per role (NFR-P-02)."""
    cache_key = f'dashboard_kpis_{request.user.role}'
    cached = cache.get(cache_key)
    if cached:
        return success_response(data=cached, message='Dashboard KPIs (cached).')

    today = timezone.now().date()
    first_day = today.replace(day=1)

    try:
        from dairypro.milk.models import MilkCollection
        from dairypro.cattle.models import Cattle
        from dairypro.sales.models import Invoice, InvoiceStatus
        from dairypro.inventory.models import InventoryItem
        from dairypro.cattle.models import Vaccination
        from django.db.models import Sum, F

        today_milk = MilkCollection.objects.filter(
            collection_date=today
        ).aggregate(t=Sum('quantity_litres'))['t'] or Decimal('0')

        active_cattle = Cattle.objects.filter(is_active=True).count()

        open_invoices_qs = Invoice.objects.filter(
            status__in=[InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE]
        )
        open_invoices = open_invoices_qs.count()
        open_invoices_value = open_invoices_qs.aggregate(
            t=Sum('total_amount'))['t'] or Decimal('0')

        low_stock = InventoryItem.objects.filter(
            quantity_on_hand__lte=F('reorder_level'), is_active=True
        ).count()

        pending_vaccinations = Vaccination.objects.filter(
            next_due_date__lte=today + timezone.timedelta(days=7),
            next_due_date__gte=today,
            cattle__is_active=True,
        ).count()

        monthly_revenue = Invoice.objects.filter(
            invoice_date__gte=first_day,
            status__in=[InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID],
        ).aggregate(t=Sum('total_amount'))['t'] or Decimal('0')

        from dairypro.hr.models import PayrollRun
        latest_payroll = PayrollRun.objects.filter(
            status__in=['Approved', 'Disbursed']
        ).order_by('-year', '-month').first()
        monthly_payroll = latest_payroll.total_net if latest_payroll else Decimal('0')

        data = {
            'today_milk_litres': float(today_milk),
            'active_cattle': active_cattle,
            'open_invoices': open_invoices,
            'open_invoices_value': float(open_invoices_value),
            'low_stock_items': low_stock,
            'pending_vaccinations': pending_vaccinations,
            'monthly_revenue': float(monthly_revenue),
            'monthly_payroll_expense': float(monthly_payroll),
        }
        cache.set(cache_key, data, CACHE_TTL)
        return success_response(data=data)

    except Exception as exc:
        logger.exception('Dashboard KPI error: %s', exc)
        return success_response(data={}, message='Dashboard data temporarily unavailable.')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def audit_log_view(request):
    """GET /api/v1/reports/audit-log/ — Super Admin only."""
    from dairypro.core.permissions import IsSuperAdmin
    from dairypro.core.models import AuditLog
    from dairypro.core.views import AuditLogListView
    return AuditLogListView.as_view()(request._request)
