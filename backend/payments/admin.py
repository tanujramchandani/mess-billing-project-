from django.contrib import admin
from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('bill', 'student', 'amount', 'payment_method', 'status', 'payment_date')
    list_filter = ('status', 'payment_method')
    search_fields = ('student__username', 'transaction_id')
    date_hierarchy = 'payment_date'
