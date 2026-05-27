"""
core/models.py — User, Role, AuditLog, LoginAttempt
ADR-005: UUID primary keys | ADR-004: Argon2id hashing
"""
import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    SUPER_ADMIN   = 'super_admin',   'Super Admin'
    FARM_MANAGER  = 'farm_manager',  'Farm Manager'
    ACCOUNTANT    = 'accountant',    'Accountant'
    FIELD_WORKER  = 'field_worker',  'Field Worker'
    VET           = 'vet',           'Vet'
    VIEWER        = 'viewer',        'Viewer'


class UserManager(BaseUserManager):
    def create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('Email is required.')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra_fields):
        extra_fields.setdefault('role', Role.SUPER_ADMIN)
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model. Email is the login identifier.
    Role determines RBAC permissions (ADR-001).
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email       = models.EmailField(unique=True)
    full_name   = models.CharField(max_length=255)
    phone       = models.CharField(max_length=20, blank=True)
    role        = models.CharField(max_length=30, choices=Role.choices, default=Role.VIEWER)
    is_active   = models.BooleanField(default=True)
    is_staff    = models.BooleanField(default=False)
    is_locked   = models.BooleanField(default=False)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_login  = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['full_name']

    class Meta:
        db_table = 'users'
        ordering = ['full_name']

    def __str__(self):
        return f'{self.full_name} ({self.role})'

    @property
    def is_account_locked(self):
        if self.is_locked and self.locked_until:
            if timezone.now() < self.locked_until:
                return True
            # Auto-unlock if time has passed
            self.is_locked = False
            self.locked_until = None
            self.save(update_fields=['is_locked', 'locked_until'])
        return False


class AuditLog(models.Model):
    """
    Append-only audit log. DB trigger prevents UPDATE/DELETE (FR-AU-05).
    No updated_at field — immutable by design.
    """
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user          = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='audit_logs')
    action        = models.CharField(max_length=50)   # CREATE, UPDATE, DELETE, LOGIN, LOGOUT
    resource_type = models.CharField(max_length=100)  # e.g. 'cattle', 'milk_collection'
    resource_id   = models.UUIDField(null=True, blank=True)
    old_values    = models.JSONField(null=True, blank=True)
    new_values    = models.JSONField(null=True, blank=True)
    ip_address    = models.GenericIPAddressField(null=True, blank=True)
    user_agent    = models.TextField(blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_log'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.action} {self.resource_type} by {self.user} @ {self.created_at}'


class LoginAttempt(models.Model):
    """Tracks failed logins for account lockout (FR-AU-04)."""
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user         = models.ForeignKey(User, on_delete=models.CASCADE, null=True, related_name='login_attempts')
    email        = models.EmailField()
    success      = models.BooleanField()
    ip_address   = models.GenericIPAddressField(null=True, blank=True)
    attempted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'login_attempts'
        indexes = [models.Index(fields=['user', 'attempted_at'])]
