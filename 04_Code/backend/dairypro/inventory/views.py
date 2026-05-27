"""inventory/views.py"""
import logging
from django.db import transaction
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import InventoryItem, StockTransaction
from .serializers import InventoryItemSerializer, StockTransactionSerializer
from dairypro.core.permissions import IsFarmManagerOrAbove
from dairypro.core.utils import write_audit_log, success_response

logger = logging.getLogger('dairypro')


class InventoryItemListCreateView(generics.ListCreateAPIView):
    serializer_class   = InventoryItemSerializer
    permission_classes = [IsAuthenticated, IsFarmManagerOrAbove]
    filterset_fields   = ['category', 'is_active']

    def get_queryset(self):
        qs = InventoryItem.objects.filter(is_active=True)
        if self.request.query_params.get('low_stock') == 'true':
            from django.db.models import F
            qs = qs.filter(quantity_on_hand__lte=F('reorder_level'))
        return qs

    def perform_create(self, serializer):
        item = serializer.save()
        write_audit_log(self.request.user, 'CREATE', 'inventory_item',
                        resource_id=item.id, new_values={'code': item.item_code},
                        request=self.request)


class InventoryItemDetailView(generics.RetrieveUpdateAPIView):
    serializer_class   = InventoryItemSerializer
    permission_classes = [IsAuthenticated, IsFarmManagerOrAbove]
    queryset           = InventoryItem.objects.filter(is_active=True)


class StockTransactionCreateView(generics.CreateAPIView):
    """POST /api/v1/inventory/transactions/ — Updates quantity_on_hand atomically."""
    serializer_class   = StockTransactionSerializer
    permission_classes = [IsAuthenticated, IsFarmManagerOrAbove]

    @transaction.atomic
    def perform_create(self, serializer):
        item     = serializer.validated_data['item']
        txn_type = serializer.validated_data['txn_type']
        qty      = serializer.validated_data['quantity']

        # Determine direction: OUT types
        out_types = ['Consumption', 'Wastage']
        delta = -abs(qty) if txn_type in out_types else abs(qty)

        # FR-I-04: Check no negative stock
        new_qty = item.quantity_on_hand + delta
        if new_qty < 0:
            raise ValidationError({
                'quantity': [f'Transaction would result in negative stock '
                             f'({item.quantity_on_hand} {item.unit} available, '
                             f'requested {abs(qty)}).']
            })

        txn = serializer.save(performed_by=self.request.user, quantity=delta)
        item.quantity_on_hand = new_qty
        item.save(update_fields=['quantity_on_hand', 'updated_at'])

        # Trigger reorder alert if below threshold
        if item.is_low_stock:
            from .tasks import send_reorder_alert
            send_reorder_alert.delay(str(item.id))

        write_audit_log(self.request.user, 'CREATE', 'stock_transaction',
                        resource_id=txn.id,
                        new_values={'item': item.item_code, 'delta': str(delta),
                                    'new_qty': str(new_qty)},
                        request=self.request)
        logger.info('Stock txn: %s %s %.3f %s | new qty: %.3f',
                    txn_type, item.item_code, qty, item.unit, new_qty)
