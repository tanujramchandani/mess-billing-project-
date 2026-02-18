from django.contrib import admin
from .models import MessRate, Attendance


@admin.register(MessRate)
class MessRateAdmin(admin.ModelAdmin):
    list_display = ('month', 'year', 'lunch_rate', 'dinner_rate', 'is_active', 'created_by')
    list_filter = ('year', 'is_active')
    search_fields = ('month', 'year')


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('student', 'date', 'lunch', 'dinner', 'marked_by', 'created_at')
    list_filter = ('lunch', 'dinner', 'date')
    search_fields = ('student__username', 'student__enrollment_number')
    date_hierarchy = 'date'
