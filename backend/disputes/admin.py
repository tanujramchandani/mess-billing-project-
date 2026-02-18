from django.contrib import admin
from .models import Dispute


@admin.register(Dispute)
class DisputeAdmin(admin.ModelAdmin):
    list_display = ('bill', 'raised_by', 'dispute_type', 'status', 'created_at')
    list_filter = ('dispute_type', 'status')
    search_fields = ('raised_by__username', 'description')
    date_hierarchy = 'created_at'
