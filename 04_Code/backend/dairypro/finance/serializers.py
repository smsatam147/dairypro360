"""finance/serializers.py — Double-entry validation in JournalEntrySerializer."""
from decimal import Decimal
from rest_framework import serializers
from .models import Account, JournalEntry, JournalLine


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Account
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class JournalLineSerializer(serializers.ModelSerializer):
    class Meta:
        model  = JournalLine
        fields = ['id', 'account', 'debit', 'credit', 'notes']

    def validate(self, data):
        if data.get('debit', 0) > 0 and data.get('credit', 0) > 0:
            raise serializers.ValidationError(
                'A line cannot have both debit and credit amounts.')
        return data


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True)

    class Meta:
        model  = JournalEntry
        fields = ['id', 'entry_number', 'entry_date', 'description',
                  'reference_type', 'reference_id', 'lines', 'created_by', 'created_at']
        read_only_fields = ['id', 'entry_number', 'created_by', 'created_at']

    def validate_lines(self, lines):
        if len(lines) < 2:
            raise serializers.ValidationError(
                'A journal entry must have at least 2 lines.')
        total_debit  = sum(Decimal(str(l.get('debit', 0)))  for l in lines)
        total_credit = sum(Decimal(str(l.get('credit', 0))) for l in lines)
        if total_debit != total_credit:
            raise serializers.ValidationError(
                f'Journal entry is unbalanced: '
                f'debit {total_debit} != credit {total_credit}')
        return lines

    def create(self, validated_data):
        from django.utils import timezone
        lines_data = validated_data.pop('lines')
        # Generate entry number: JE-YYYY-NNNN
        year = timezone.now().year
        count = JournalEntry.objects.filter(
            created_at__year=year).count() + 1
        validated_data['entry_number'] = f'JE-{year}-{count:04d}'
        entry = JournalEntry.objects.create(**validated_data)
        for line_data in lines_data:
            JournalLine.objects.create(entry=entry, **line_data)
        return entry
