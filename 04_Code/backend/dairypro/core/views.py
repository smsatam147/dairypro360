"""core/views.py — Auth views (login, refresh, logout, change password, users)."""
import logging
from django.utils import timezone
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .models import User, AuditLog
from .serializers import (LoginSerializer, UserSerializer,
                           UserCreateSerializer, ChangePasswordSerializer)
from .permissions import IsSuperAdmin
from .utils import success_response, write_audit_log, get_client_ip

logger = logging.getLogger('dairypro')


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    """POST /api/v1/auth/login/ — Returns JWT access + refresh tokens."""
    serializer = LoginSerializer(data=request.data,
                                 context={'ip': get_client_ip(request)})
    serializer.is_valid(raise_exception=True)
    user = serializer.validated_data['user']

    refresh = RefreshToken.for_user(user)
    access  = str(refresh.access_token)

    # Update last_login
    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])

    write_audit_log(user, 'LOGIN', 'user', resource_id=user.id, request=request)
    logger.info('User logged in: %s role=%s', user.email, user.role)

    response = success_response(
        data={
            'access_token': access,
            'user': {
                'id': str(user.id),
                'email': user.email,
                'full_name': user.full_name,
                'role': user.role,
            }
        },
        message='Login successful.'
    )
    # Store refresh token in httpOnly cookie (ADR-003)
    response.set_cookie(
        key='refresh_token',
        value=str(refresh),
        httponly=True,
        secure=not request.META.get('SERVER_NAME') == 'localhost',
        samesite='Strict',
        max_age=7 * 24 * 60 * 60,  # 7 days
    )
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh_view(request):
    """POST /api/v1/auth/refresh/ — Reads refresh_token from httpOnly cookie."""
    refresh_token = request.COOKIES.get('refresh_token')
    if not refresh_token:
        return Response({'status': 'error', 'message': 'Refresh token missing.',
                         'data': None, 'errors': {}},
                        status=status.HTTP_401_UNAUTHORIZED)
    try:
        refresh = RefreshToken(refresh_token)
        access  = str(refresh.access_token)
        response = success_response(data={'access_token': access},
                                    message='Token refreshed.')
        # Rotate refresh token
        response.set_cookie(
            key='refresh_token',
            value=str(refresh),
            httponly=True,
            secure=not request.META.get('SERVER_NAME') == 'localhost',
            samesite='Strict',
            max_age=7 * 24 * 60 * 60,
        )
        return response
    except TokenError as e:
        return Response({'status': 'error', 'message': str(e),
                         'data': None, 'errors': {}},
                        status=status.HTTP_401_UNAUTHORIZED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """POST /api/v1/auth/logout/ — Blacklists refresh token."""
    refresh_token = request.COOKIES.get('refresh_token')
    if refresh_token:
        try:
            RefreshToken(refresh_token).blacklist()
        except TokenError:
            pass  # Already blacklisted or invalid — proceed with logout
    write_audit_log(request.user, 'LOGOUT', 'user',
                    resource_id=request.user.id, request=request)
    response = Response(status=status.HTTP_204_NO_CONTENT)
    response.delete_cookie('refresh_token')
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_view(request):
    """POST /api/v1/auth/change-password/"""
    serializer = ChangePasswordSerializer(data=request.data,
                                          context={'request': request})
    serializer.is_valid(raise_exception=True)
    request.user.set_password(serializer.validated_data['new_password'])
    request.user.save(update_fields=['password'])
    write_audit_log(request.user, 'UPDATE', 'user',
                    resource_id=request.user.id,
                    new_values={'action': 'password_changed'}, request=request)
    return success_response(message='Password changed successfully.')


class UserListCreateView(generics.ListCreateAPIView):
    """GET/POST /api/v1/users/ — Super Admin only."""
    queryset            = User.objects.all().order_by('full_name')
    permission_classes  = [IsAuthenticated, IsSuperAdmin]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return UserCreateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        write_audit_log(self.request.user, 'CREATE', 'user',
                        resource_id=user.id,
                        new_values={'email': user.email, 'role': user.role},
                        request=self.request)


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """GET/PUT/DELETE /api/v1/users/{id}/ — Super Admin only."""
    queryset           = User.objects.all()
    serializer_class   = UserSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def perform_update(self, serializer):
        old = UserSerializer(self.get_object()).data
        user = serializer.save()
        write_audit_log(self.request.user, 'UPDATE', 'user',
                        resource_id=user.id,
                        old_values=dict(old),
                        new_values=UserSerializer(user).data,
                        request=self.request)

    def perform_destroy(self, instance):
        # Soft delete — never hard-delete users (audit trail integrity)
        instance.is_active = False
        instance.save(update_fields=['is_active'])
        write_audit_log(self.request.user, 'DELETE', 'user',
                        resource_id=instance.id,
                        old_values={'email': instance.email},
                        request=self.request)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me_view(request):
    """GET /api/v1/auth/me/ — Current user info."""
    return success_response(data=UserSerializer(request.user).data)


class AuditLogListView(generics.ListAPIView):
    """GET /api/v1/reports/audit-log/ — Super Admin only."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    filterset_fields   = ['action', 'resource_type', 'user']

    def get_queryset(self):
        from .models import AuditLog
        qs = AuditLog.objects.select_related('user').order_by('-created_at')
        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        return qs

    def list(self, request, *args, **kwargs):
        from rest_framework.serializers import ModelSerializer
        class AL(ModelSerializer):
            class Meta:
                model = AuditLog
                fields = '__all__'
        qs = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(qs)
        data = AL(page, many=True).data
        return self.get_paginated_response(data)
