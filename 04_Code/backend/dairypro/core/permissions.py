"""
core/permissions.py — Role-Based Access Control
DRF permission classes enforcing the RBAC matrix (SAD Section 3.3).
"""
from rest_framework.permissions import BasePermission
from .models import Role


class IsRoleAllowed(BasePermission):
    """
    Usage:
        permission_classes = [IsAuthenticated, IsRoleAllowed]
        allowed_roles = [Role.FARM_MANAGER, Role.SUPER_ADMIN]
    """
    allowed_roles = []

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        view_roles = getattr(view, 'allowed_roles', self.allowed_roles)
        return request.user.role in view_roles


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return (request.user and request.user.is_authenticated
                and request.user.role == Role.SUPER_ADMIN)


class IsFarmManagerOrAbove(BasePermission):
    ALLOWED = [Role.SUPER_ADMIN, Role.FARM_MANAGER]
    def has_permission(self, request, view):
        return (request.user and request.user.is_authenticated
                and request.user.role in self.ALLOWED)


class IsAccountantOrAbove(BasePermission):
    ALLOWED = [Role.SUPER_ADMIN, Role.FARM_MANAGER, Role.ACCOUNTANT]
    def has_permission(self, request, view):
        return (request.user and request.user.is_authenticated
                and request.user.role in self.ALLOWED)


class IsVetOrFarmManager(BasePermission):
    ALLOWED = [Role.SUPER_ADMIN, Role.FARM_MANAGER, Role.VET]
    def has_permission(self, request, view):
        return (request.user and request.user.is_authenticated
                and request.user.role in self.ALLOWED)


class IsAnyAuthenticated(BasePermission):
    """Any authenticated user — used for dashboard (Viewer+)."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated
