"""core/serializers.py — Auth and User serializers."""
from django.contrib.auth import authenticate
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers
from django.conf import settings
from .models import User, Role, LoginAttempt


class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, data):
        email    = data['email'].lower().strip()
        password = data['password']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError('Invalid email or password.')

        # Check lockout (FR-AU-04)
        if user.is_account_locked:
            raise serializers.ValidationError(
                'Account locked after too many failed attempts. Contact Super Admin.'
            )

        if not authenticate(username=email, password=password):
            # Record failed attempt
            LoginAttempt.objects.create(user=user, email=email, success=False,
                                        ip_address=self.context.get('ip'))
            # Count recent failures
            cutoff = timezone.now() - timedelta(
                minutes=settings.LOCKOUT_DURATION_MINUTES
            )
            fail_count = LoginAttempt.objects.filter(
                user=user, success=False, attempted_at__gte=cutoff
            ).count()
            if fail_count >= settings.MAX_LOGIN_ATTEMPTS:
                user.is_locked = True
                user.locked_until = timezone.now() + timedelta(
                    minutes=settings.LOCKOUT_DURATION_MINUTES
                )
                user.save(update_fields=['is_locked', 'locked_until'])
                raise serializers.ValidationError(
                    'Account locked after 5 failed attempts. Contact Super Admin.'
                )
            raise serializers.ValidationError('Invalid email or password.')

        if not user.is_active:
            raise serializers.ValidationError('Account is disabled.')

        # Successful login
        LoginAttempt.objects.create(user=user, email=email, success=True,
                                    ip_address=self.context.get('ip'))
        data['user'] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model  = User
        fields = ['id', 'email', 'full_name', 'phone', 'role',
                  'is_active', 'is_locked', 'last_login', 'created_at']
        read_only_fields = ['id', 'is_locked', 'last_login', 'created_at']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model  = User
        fields = ['email', 'password', 'full_name', 'phone', 'role']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value
