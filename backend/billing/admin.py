from django.contrib import admin
from .models import Bill


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display = ('student', 'month', 'year', 'total_amount', 'status', 'generated_at')
    list_filter = ('status', 'year', 'month')
    search_fields = ('student__username', 'student__enrollment_number')
    date_hierarchy = 'generated_at'
