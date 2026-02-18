from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'role', 'phone', 'enrollment_number', 'hostel', 'is_active')
    list_filter = ('role', 'is_active', 'hostel')
    search_fields = ('username', 'email', 'enrollment_number', 'phone')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Additional Info', {
            'fields': ('role', 'phone', 'enrollment_number', 'room_number', 'hostel'),
        }),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {
            'fields': ('role', 'phone', 'enrollment_number', 'room_number', 'hostel'),
        }),
    )
