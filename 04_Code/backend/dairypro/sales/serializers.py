"""sales/serializers.py"""
from decimal import Decimal
from rest_framework import serializers
from .models import Customer, SalesOrder, OrderLine, Invoice, Delivery


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Customer
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class OrderLineSerializer(serializers.ModelSerializer):
    class Meta:
        model  = OrderLine
        fields = '__all__'
        read_only_fields = ['id', 'line_total']


class SalesOrderSerializer(serializers.ModelSerializer):
    lines = OrderLineSerializer(many=True)

    class Meta:
        model  = SalesOrder
        fields = '__all__'
        read_only_fields = ['id', 'order_date', 'total_amount', 'created_by',
                            'created_at', 'updated_at']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        order = SalesOrder.objects.create(**validated_data)
        total = Decimal('0')
        for line in lines_data:
            qty        = line['quantity']
            price      = line['unit_price']
            discount   = line.get('discount_pct', Decimal('0'))
            line_total = qty * price * (1 - discount / 100)
            OrderLine.objects.create(order=order, line_total=line_total.quantize(Decimal('0.01')), **line)
            total += line_total
        order.total_amount = total.quantize(Decimal('0.01'))
        order.save(update_fields=['total_amount'])
        return order


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Invoice
        fields = '__all__'
        read_only_fields = ['id', 'invoice_number', 'invoice_date', 'created_by',
                            'created_at', 'updated_at',
                            'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount']

    def validate(self, data):
        is_interstate = data.get('igst_rate', 0) > 0
        if is_interstate and (data.get('cgst_rate', 0) > 0 or data.get('sgst_rate', 0) > 0):
            raise serializers.ValidationError(
                'IGST (interstate) and CGST/SGST (intrastate) cannot both be applied.')
        return data

    def create(self, validated_data):
        from django.utils import timezone
        subtotal = validated_data['subtotal']
        # Compute tax amounts
        validated_data['cgst_amount'] = (subtotal * validated_data.get('cgst_rate', 0) / 100).quantize(Decimal('0.01'))
        validated_data['sgst_amount'] = (subtotal * validated_data.get('sgst_rate', 0) / 100).quantize(Decimal('0.01'))
        validated_data['igst_amount'] = (subtotal * validated_data.get('igst_rate', 0) / 100).quantize(Decimal('0.01'))
        validated_data['total_amount'] = (
            subtotal + validated_data['cgst_amount'] +
            validated_data['sgst_amount'] + validated_data['igst_amount']
        )
        # Generate invoice number: INV-YYYY-MMDD-NNNN
        today = timezone.now().date()
        count = Invoice.objects.filter(invoice_date=today).count() + 1
        validated_data['invoice_number'] = f'INV-{today.year}-{today.month:02d}{today.day:02d}-{count:04d}'
        return super().create(validated_data)
