from django.db import models
from django.conf import settings


class Payment(models.Model):
    """Payment record for a bill submitted by a student."""

    METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('online', 'Online'),
        ('upi', 'UPI'),
        ('cheque', 'Cheque'),
        ('other', 'Other'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]

    bill = models.ForeignKey(
        'billing.Bill',
        on_delete=models.CASCADE,
        related_name='payments',
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='payments',
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    payment_method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    transaction_id = models.CharField(max_length=100, blank=True)
    receipt_image = models.ImageField(
        upload_to='receipts/', blank=True, null=True
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending'
    )
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_payments',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', 'status']),
            models.Index(fields=['bill', 'status']),
            models.Index(fields=['status', 'payment_method']),
            models.Index(fields=['payment_date']),
        ]

    def __str__(self):
        return f"Payment #{self.id} - Rs.{self.amount} - {self.status}"
