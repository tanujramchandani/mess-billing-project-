from django.db import models
from django.conf import settings


class Dispute(models.Model):
    """Dispute raised by a student against a bill."""

    TYPE_CHOICES = [
        ('billing', 'Billing'),
        ('attendance', 'Attendance'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('under_review', 'Under Review'),
        ('resolved', 'Resolved'),
        ('rejected', 'Rejected'),
    ]

    bill = models.ForeignKey(
        'billing.Bill',
        on_delete=models.CASCADE,
        related_name='disputes',
    )
    raised_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='raised_disputes',
    )
    dispute_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    description = models.TextField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='open'
    )
    contractor_response = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resolved_disputes',
    )
    resolution_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Dispute #{self.id} - {self.bill} - {self.status}"
