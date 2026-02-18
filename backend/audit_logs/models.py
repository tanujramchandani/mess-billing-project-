from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    """Tracks user actions across the system for auditing purposes."""

    ACTION_CHOICES = [
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('verify', 'Verify'),
        ('reject', 'Reject'),
        ('generate', 'Generate'),
        ('resolve', 'Resolve'),
        ('export', 'Export'),
        ('bulk_update', 'Bulk Update'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='audit_logs',
    )
    user_role = models.CharField(max_length=50, blank=True, null=True)
    action = models.CharField(max_length=50, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100)
    object_id = models.IntegerField(null=True, blank=True)
    old_values = models.JSONField(default=dict, blank=True)
    new_values = models.JSONField(default=dict, blank=True)
    changes = models.JSONField(default=dict, blank=True)  # Kept for backward compatibility
    description = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user', 'action']),
            models.Index(fields=['model_name', 'object_id']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['action']),
        ]

    def __str__(self):
        return f"{self.user} - {self.action} - {self.model_name} #{self.object_id}"

    def save(self, *args, **kwargs):
        # Auto-populate user_role if user is set
        if self.user and not self.user_role:
            self.user_role = self.user.role
        super().save(*args, **kwargs)
