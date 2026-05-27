from rest_framework import serializers
from .models import Employee, AttendanceRecord, PayrollRun, PayrollLine


class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Employee
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class AttendanceRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AttendanceRecord
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class PayrollLineSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)

    class Meta:
        model  = PayrollLine
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class PayrollRunSerializer(serializers.ModelSerializer):
    lines = PayrollLineSerializer(many=True, read_only=True)

    class Meta:
        model  = PayrollRun
        fields = '__all__'
        read_only_fields = ['id', 'status', 'total_gross', 'total_pf',
                            'total_esi', 'total_net', 'created_at']
