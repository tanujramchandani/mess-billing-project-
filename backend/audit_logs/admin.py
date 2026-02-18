from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action', 'model_name', 'object_id', 'timestamp')
    list_filter = ('action', 'model_name')
    search_fields = ('user__username', 'action')
    date_hierarchy = 'timestamp'
    readonly_fields = ('user', 'action', 'model_name', 'object_id', 'changes', 'timestamp', 'ip_address')
