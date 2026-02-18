from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit log entries."""

    username = serializers.CharField(source='user.username', read_only=True, default=None)
    user_full_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'username', 'user_full_name', 'user_role',
            'action', 'model_name', 'object_id',
            'old_values', 'new_values', 'changes', 'description',
            'timestamp', 'ip_address', 'user_agent',
        ]
        read_only_fields = fields

    def get_user_full_name(self, obj):
        if obj.user:
            return obj.user.get_full_name() or obj.user.username
        return None
