"""cattle/views.py — Cattle CRUD, health records, vaccinations, breeding."""
import logging
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Cattle, HealthRecord, Vaccination, BreedingRecord
from .serializers import (CattleListSerializer, CattleDetailSerializer,
                           HealthRecordSerializer, VaccinationSerializer,
                           BreedingRecordSerializer, CattleDeleteSerializer)
from dairypro.core.permissions import IsVetOrFarmManager, IsFarmManagerOrAbove
from dairypro.core.utils import write_audit_log, success_response

logger = logging.getLogger('dairypro')


class CattleListCreateView(generics.ListCreateAPIView):
    """GET /api/v1/cattle/ | POST /api/v1/cattle/"""
    permission_classes = [IsAuthenticated, IsVetOrFarmManager]
    filter_backends    = [DjangoFilterBackend]
    filterset_fields   = ['status', 'breed', 'is_active']

    def get_queryset(self):
        return Cattle.objects.filter(is_active=True).select_related('created_by')

    def get_serializer_class(self):
        return CattleDetailSerializer if self.request.method == 'POST' else CattleListSerializer

    def perform_create(self, serializer):
        cattle = serializer.save(created_by=self.request.user)
        write_audit_log(self.request.user, 'CREATE', 'cattle',
                        resource_id=cattle.id,
                        new_values={'tag_number': cattle.tag_number, 'breed': cattle.breed},
                        request=self.request)
        logger.info('Cattle created: %s by %s', cattle.tag_number, self.request.user.email)


class CattleDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT /api/v1/cattle/{id}/ | DELETE with reason"""
    permission_classes = [IsAuthenticated, IsVetOrFarmManager]
    queryset           = Cattle.objects.filter(is_active=True)

    def get_serializer_class(self):
        return CattleDetailSerializer

    def perform_update(self, serializer):
        old = CattleDetailSerializer(self.get_object()).data
        cattle = serializer.save()
        write_audit_log(self.request.user, 'UPDATE', 'cattle',
                        resource_id=cattle.id, old_values=dict(old),
                        new_values=CattleDetailSerializer(cattle).data,
                        request=self.request)

    def destroy(self, request, *args, **kwargs):
        # Validate reason (FR-C-04 — BUG-03 fix)
        ser = CattleDeleteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        reason = ser.validated_data['reason']

        cattle = self.get_object()
        old_status = cattle.status
        cattle.is_active = False
        cattle.deleted_at = timezone.now()
        cattle.status = reason  # 'Sold' or 'Deceased'
        cattle.save(update_fields=['is_active', 'deleted_at', 'status'])

        write_audit_log(request.user, 'DELETE', 'cattle',
                        resource_id=cattle.id,
                        old_values={'status': old_status},
                        new_values={'reason': reason},
                        request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class HealthRecordListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/cattle/{cattle_id}/health-records/"""
    serializer_class   = HealthRecordSerializer
    permission_classes = [IsAuthenticated, IsVetOrFarmManager]

    def get_queryset(self):
        return HealthRecord.objects.filter(
            cattle_id=self.kwargs['cattle_id']
        ).select_related('vet')

    def perform_create(self, serializer):
        hr = serializer.save(cattle_id=self.kwargs['cattle_id'],
                             vet=self.request.user)
        write_audit_log(self.request.user, 'CREATE', 'health_record',
                        resource_id=hr.id, request=self.request)


class VaccinationListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/cattle/{cattle_id}/vaccinations/"""
    serializer_class   = VaccinationSerializer
    permission_classes = [IsAuthenticated, IsVetOrFarmManager]

    def get_queryset(self):
        return Vaccination.objects.filter(cattle_id=self.kwargs['cattle_id'])

    def perform_create(self, serializer):
        v = serializer.save(cattle_id=self.kwargs['cattle_id'], vet=self.request.user)
        write_audit_log(self.request.user, 'CREATE', 'vaccination',
                        resource_id=v.id, request=self.request)


class BreedingRecordListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/cattle/{cattle_id}/breeding-records/"""
    serializer_class   = BreedingRecordSerializer
    permission_classes = [IsAuthenticated, IsFarmManagerOrAbove]

    def get_queryset(self):
        return BreedingRecord.objects.filter(cattle_id=self.kwargs['cattle_id'])

    def perform_create(self, serializer):
        br = serializer.save(cattle_id=self.kwargs['cattle_id'])
        write_audit_log(self.request.user, 'CREATE', 'breeding_record',
                        resource_id=br.id, request=self.request)
