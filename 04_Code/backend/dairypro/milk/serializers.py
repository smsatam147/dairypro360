from rest_framework import serializers
from .models import MilkCollection, YieldAlert
from dairypro.cattle.serializers import CattleListSerializer


class MilkCollectionSerializer(serializers.ModelSerializer):
    cattle_detail = CattleListSerializer(source='cattle', read_only=True)

    class Meta:
        model  = MilkCollection
        fields = '__all__'
        read_only_fields = ['id', 'field_worker', 'quality_grade', 'created_at', 'updated_at']


class MilkCollectionSyncSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MilkCollection
        fields = ['cattle', 'collection_date', 'shift', 'quantity_litres',
                  'fat_percentage', 'snf_percentage', 'temperature_celsius', 'notes']


class YieldAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model  = YieldAlert
        fields = '__all__'
        read_only_fields = ['id', 'created_at']
