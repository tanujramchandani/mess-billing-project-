from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User


class UserSerializer(serializers.ModelSerializer):
    """Serializer for reading/updating user profile information."""

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'phone', 'enrollment_number', 'room_number', 'hostel',
        ]
        read_only_fields = ['id', 'username', 'role']


class RegisterSerializer(serializers.ModelSerializer):
    """Serializer for user registration with password confirmation."""

    password = serializers.CharField(write_only=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password_confirm',
            'first_name', 'last_name', 'role', 'phone',
            'enrollment_number', 'room_number', 'hostel',
        ]

    def validate(self, attrs):
        if attrs['password'] != attrs.pop('password_confirm'):
            raise serializers.ValidationError(
                {"password": "Passwords don't match."}
            )
        if attrs.get('role') == 'student' and not attrs.get('enrollment_number'):
            raise serializers.ValidationError(
                {"enrollment_number": "Required for students."}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    """Serializer for user login that authenticates credentials."""

    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, attrs):
        user = authenticate(
            username=attrs['username'],
            password=attrs['password'],
        )
        if not user:
            raise serializers.ValidationError(
                {"detail": "Invalid username or password."}
            )
        if not user.is_active:
            raise serializers.ValidationError(
                {"detail": "Account is disabled."}
            )
        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    """Serializer for changing the authenticated user's password."""

    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
