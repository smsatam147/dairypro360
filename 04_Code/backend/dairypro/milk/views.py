"""milk/views.py — Milk collection, daily summary, offline sync."""
import logging
from decimal import Decimal
from django.db.models import Sum, Avg, Count
from django.db import IntegrityError
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import MilkCollection, Shift
from .serializers import MilkCollectionSerializer, MilkCollectionSyncSerializer
from dairypro.core.permissions import IsFarmManagerOrAbove, IsAnyAuthenticated
from dairypro.core.utils import write_audit_log, success_response
from dairypro.cattle.models import Cattle, CattleStatus

logger = logging.getLogger('dairypro')

DEVIATION_THRESHOLD = Decimal('20.0')  # FR-M-04: alert if >20% drop vs 7-day avg


class MilkCollectionListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/milk/collections/"""
    serializer_class   = MilkCollectionSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields   = ['collection_date', 'shift', 'cattle', 'quality_grade']

    def get_queryset(self):
        user = self.request.user
        qs = MilkCollection.objects.select_related('cattle', 'field_worker')
        # Field workers see only their own entries (FR-AU-01 RBAC)
        from dairypro.core.models import Role
        if user.role == Role.FIELD_WORKER:
            qs = qs.filter(field_worker=user)
        return qs.order_by('-collection_date', '-created_at')

    def perform_create(self, serializer):
        cattle = serializer.validated_data['cattle']
        # FR-M-03: Block entry for inactive cattle
        if cattle.status not in [CattleStatus.ACTIVE, CattleStatus.LACTATING]:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied(
                f'Cattle {cattle.tag_number} has status "{cattle.status}". '
                'Only Active or Lactating cattle can have milk recorded.'
            )
        mc = serializer.save(field_worker=self.request.user)
        # FR-M-04: Check yield deviation vs 7-day rolling average
        self._check_yield_alert(mc)
        write_audit_log(self.request.user, 'CREATE', 'milk_collection',
                        resource_id=mc.id,
                        new_values={'cattle': str(cattle.id),
                                    'qty': str(mc.quantity_litres),
                                    'grade': mc.quality_grade},
                        request=self.request)

    def _check_yield_alert(self, mc):
        from datetime import timedelta
        from django.utils import timezone
        from .models import YieldAlert
        cutoff = mc.collection_date - timedelta(days=7)
        avg_qs = MilkCollection.objects.filter(
            cattle=mc.cattle,
            collection_date__gte=cutoff,
            collection_date__lt=mc.collection_date,
            shift=mc.shift,
        ).aggregate(avg=Avg('quantity_litres'))
        avg_yield = avg_qs['avg']
        if avg_yield and avg_yield > 0:
            deviation = ((avg_yield - mc.quantity_litres) / avg_yield) * 100
            if deviation >= DEVIATION_THRESHOLD:
                YieldAlert.objects.create(
                    cattle=mc.cattle,
                    alert_date=mc.collection_date,
                    expected_yield=avg_yield,
                    actual_yield=mc.quantity_litres,
                    deviation_pct=deviation,
                )
                logger.warning('Yield alert created for %s: %.1f%% drop',
                               mc.cattle.tag_number, deviation)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsFarmManagerOrAbove])
def daily_summary_view(request):
    """GET /api/v1/milk/summary/daily/?date=YYYY-MM-DD"""
    from .serializers import DailySummarySerializer
    date = request.query_params.get('date')
    if not date:
        from django.utils import timezone
        date = timezone.now().date()

    qs = MilkCollection.objects.filter(collection_date=date)
    agg = qs.aggregate(
        total_litres=Sum('quantity_litres'),
        avg_fat=Avg('fat_percentage'),
        avg_snf=Avg('snf_percentage'),
        cattle_count=Count('cattle', distinct=True),
    )
    morning = qs.filter(shift=Shift.MORNING).aggregate(l=Sum('quantity_litres'))['l'] or 0
    evening = qs.filter(shift=Shift.EVENING).aggregate(l=Sum('quantity_litres'))['l'] or 0
    grade_breakdown = {g: qs.filter(quality_grade=g).count() for g in ['A','B','C','Rejected']}

    return success_response(data={
        'date': str(date),
        'total_litres': agg['total_litres'] or 0,
        'morning_litres': morning,
        'evening_litres': evening,
        'cattle_count': agg['cattle_count'] or 0,
        'avg_fat_pct': round(agg['avg_fat'] or 0, 2),
        'avg_snf_pct': round(agg['avg_snf'] or 0, 2),
        'grade_breakdown': grade_breakdown,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_offline_entries(request):
    """POST /api/v1/milk/collections/sync/ — Batch offline sync (FR-AU-06)."""
    entries = request.data.get('entries', [])
    accepted, rejected = 0, []

    for i, entry_data in enumerate(entries):
        ser = MilkCollectionSerializer(data=entry_data)
        if not ser.is_valid():
            rejected.append({'entry_index': i, 'reason': str(ser.errors)})
            continue
        try:
            cattle = ser.validated_data['cattle']
            if cattle.status not in [CattleStatus.ACTIVE, CattleStatus.LACTATING]:
                rejected.append({'entry_index': i,
                                  'reason': f'Cattle {cattle.tag_number} is not active.'})
                continue
            mc = ser.save(field_worker=request.user, is_synced=True)
            accepted += 1
        except IntegrityError:
            rejected.append({'entry_index': i,
                              'reason': 'Duplicate entry for this cattle/date/shift.'})

    resp_status = status.HTTP_207_MULTI_STATUS if rejected else status.HTTP_200_OK
    return Response({
        'status': 'partial' if rejected else 'success',
        'data': {'accepted': accepted, 'rejected': len(rejected), 'conflicts': rejected},
        'message': f'{accepted} entries accepted, {len(rejected)} rejected.',
        'errors': {},
    }, status=resp_status)
