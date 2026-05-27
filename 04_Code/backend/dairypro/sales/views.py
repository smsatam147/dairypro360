"""sales/views.py"""
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .models import Customer, SalesOrder, Invoice
from .serializers import CustomerSerializer, SalesOrderSerializer, InvoiceSerializer
from dairypro.core.permissions import IsAccountantOrAbove
from dairypro.core.utils import write_audit_log


class CustomerListCreateView(generics.ListCreateAPIView):
    serializer_class   = CustomerSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    queryset           = Customer.objects.filter(is_active=True)


class SalesOrderListCreateView(generics.ListCreateAPIView):
    serializer_class   = SalesOrderSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    filterset_fields   = ['status', 'customer', 'order_date']

    def get_queryset(self):
        return SalesOrder.objects.prefetch_related('lines').select_related('customer')

    def perform_create(self, serializer):
        order = serializer.save(created_by=self.request.user)
        write_audit_log(self.request.user, 'CREATE', 'sales_order',
                        resource_id=order.id,
                        new_values={'total': str(order.total_amount)},
                        request=self.request)


class SalesOrderDetailView(generics.RetrieveUpdateAPIView):
    serializer_class   = SalesOrderSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    queryset           = SalesOrder.objects.prefetch_related('lines')


class InvoiceListCreateView(generics.ListCreateAPIView):
    serializer_class   = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    filterset_fields   = ['status', 'customer', 'invoice_date']

    def get_queryset(self):
        return Invoice.objects.select_related('customer', 'order')

    def perform_create(self, serializer):
        invoice = serializer.save(created_by=self.request.user)
        write_audit_log(self.request.user, 'CREATE', 'invoice',
                        resource_id=invoice.id,
                        new_values={'number': invoice.invoice_number,
                                    'total': str(invoice.total_amount)},
                        request=self.request)


class InvoiceDetailView(generics.RetrieveAPIView):
    serializer_class   = InvoiceSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    queryset           = Invoice.objects.all()
