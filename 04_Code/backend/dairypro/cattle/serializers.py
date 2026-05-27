"""cattle/serializers.py"""
from rest_framework import serializers
from .models import Cattle, HealthRecord, Vaccination, BreedingRecord


class CattleListSerializer(serializers.ModelSerializer):
    age_months = serializers.ReadOnlyField()

    class Meta:
        model  = Cattle
        fields = ['id', 'tag_number', 'name', 'breed', 'status',
                  'date_of_birth', 'age_months', 'is_active']


class CattleDetailSerializer(serializers.ModelSerializer):
    age_months = serializers.ReadOnlyField()

    class Meta:
        model  = Cattle
        fields = '__all__'
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at',
                            'is_active', 'deleted_at']


class HealthRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HealthRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class VaccinationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Vaccination
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class BreedingRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model  = BreedingRecord
        fields = '__all__'
        read_only_fields = ['id', 'expected_calving', 'created_at', 'updated_at']


class CattleDeleteSerializer(serializers.Serializer):
    reason = serializers.ChoiceField(choices=['Sold', 'Deceased'])
