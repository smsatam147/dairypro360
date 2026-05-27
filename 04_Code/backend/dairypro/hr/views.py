"""hr/views.py — Employees, Attendance, Payroll."""
import logging
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from .models import Employee, AttendanceRecord, PayrollRun
from .serializers import (EmployeeSerializer, AttendanceRecordSerializer,
                           PayrollRunSerializer)
from dairypro.core.permissions import IsAccountantOrAbove
from dairypro.core.utils import write_audit_log, success_response

logger = logging.getLogger('dairypro')


class EmployeeListCreateView(generics.ListCreateAPIView):
    serializer_class   = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    filterset_fields   = ['department', 'employment_type', 'is_active']
    queryset           = Employee.objects.filter(is_active=True)

    def perform_create(self, serializer):
        emp = serializer.save()
        write_audit_log(self.request.user, 'CREATE', 'employee',
                        resource_id=emp.id,
                        new_values={'code': emp.employee_code, 'name': emp.full_name},
                        request=self.request)


class EmployeeDetailView(generics.RetrieveUpdateAPIView):
    serializer_class   = EmployeeSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    queryset           = Employee.objects.all()


class AttendanceListCreateView(generics.ListCreateAPIView):
    serializer_class   = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    filterset_fields   = ['employee', 'attendance_date', 'status']

    def get_queryset(self):
        return AttendanceRecord.objects.select_related('employee')


class PayrollRunListCreateView(generics.ListCreateAPIView):
    serializer_class   = PayrollRunSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    queryset           = PayrollRun.objects.all()

    def create(self, request, *args, **kwargs):
        month = request.data.get('month')
        year  = request.data.get('year')
        if not month or not year:
            raise ValidationError({'detail': 'month and year are required.'})
        if PayrollRun.objects.filter(month=month, year=year).exists():
            raise ValidationError({'detail': f'Payroll run for {month}/{year} already exists.'})

        run = PayrollRun.objects.create(month=month, year=year)
        from .tasks import compute_payroll
        task = compute_payroll.delay(str(run.id))

        write_audit_log(request.user, 'CREATE', 'payroll_run',
                        resource_id=run.id,
                        new_values={'month': month, 'year': year},
                        request=request)
        return Response({
            'status': 'success',
            'data': {'run_id': str(run.id), 'task_id': task.id},
            'message': f'Payroll calculation started for {month}/{year}.',
            'errors': {},
        }, status=status.HTTP_202_ACCEPTED)


class PayrollRunDetailView(generics.RetrieveAPIView):
    serializer_class   = PayrollRunSerializer
    permission_classes = [IsAuthenticated, IsAccountantOrAbove]
    queryset           = PayrollRun.objects.prefetch_related('lines__employee')


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAccountantOrAbove])
def approve_payroll_run(request, pk):
    """POST /api/v1/hr/payroll-runs/{id}/approve/"""
    try:
        run = PayrollRun.objects.get(id=pk)
    except PayrollRun.DoesNotExist:
        return Response({'status': 'error', 'message': 'Not found.', 'data': None, 'errors': {}},
                        status=status.HTTP_404_NOT_FOUND)
    if run.status != PayrollRun.Status.DRAFT:
        raise ValidationError({'detail': f'Payroll run is already {run.status}.'})
    run.status = PayrollRun.Status.APPROVED
    run.approved_by = request.user
    run.approved_at = timezone.now()
    run.save(update_fields=['status', 'approved_by', 'approved_at'])
    write_audit_log(request.user, 'UPDATE', 'payroll_run',
                    resource_id=run.id,
                    new_values={'status': 'Approved'},
                    request=request)
    return success_response(message=f'Payroll run {run.month}/{run.year} approved.')
