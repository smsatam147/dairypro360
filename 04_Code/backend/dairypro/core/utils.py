"""
core/utils.py — Shared utilities: audit logging, exception handler, helpers.
"""
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger('dairypro')


def custom_exception_handler(exc, context):
    """
    DRF custom exception handler — returns standardised JSON envelope.
    { status, data, message, errors }
    """
    response = exception_handler(exc, context)

    if response is not None:
        errors = response.data if isinstance(response.data, dict) else {}
        # Extract a clean message
        if 'detail' in errors:
            message = str(errors.pop('detail'))
        elif 'non_field_errors' in errors:
            message = str(errors.pop('non_field_errors')[0])
        else:
            message = 'Validation error. See errors field for details.'

        response.data = {
            'status': 'error',
            'data': None,
            'message': message,
            'errors': errors,
        }
    else:
        # Unhandled exception — log it, return 500
        logger.exception('Unhandled exception: %s', exc)
        response = Response({
            'status': 'error',
            'data': None,
            'message': 'An unexpected error occurred. The incident has been logged.',
            'errors': {},
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return response


def success_response(data=None, message='Success', status_code=status.HTTP_200_OK):
    return Response({
        'status': 'success',
        'data': data,
        'message': message,
        'errors': {},
    }, status=status_code)


def write_audit_log(user, action, resource_type, resource_id=None,
                    old_values=None, new_values=None, request=None):
    """
    Write an immutable audit log entry (FR-AU-05).
    PII fields (password, token) stripped before storage (NFR-SEC-08).
    """
    from .models import AuditLog

    STRIP_FIELDS = {'password', 'password_hash', 'token', 'refresh', 'access',
                    'otp_hash', 'aadhaar', 'pan_number'}

    def strip_pii(d):
        if not isinstance(d, dict):
            return d
        return {k: '***' if k in STRIP_FIELDS else v for k, v in d.items()}

    ip = None
    ua = ''
    if request:
        ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR'))
        if ip and ',' in ip:
            ip = ip.split(',')[0].strip()
        ua = request.META.get('HTTP_USER_AGENT', '')

    AuditLog.objects.create(
        user=user,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        old_values=strip_pii(old_values),
        new_values=strip_pii(new_values),
        ip_address=ip,
        user_agent=ua[:500],
    )


def get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded:
        return x_forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')
