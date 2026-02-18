from django.db import models
from django.conf import settings


class BillingCycle(models.Model):
    """
    Manages billing cycle status for a given month/year.
    Controls when attendance can be edited, bills generated, and payments processed.
    """

    STATUS_CHOICES = [
        ('open', 'Open'),               # Attendance editable, no bills yet
        ('billed', 'Billed'),           # Bills generated, attendance locked
        ('payment_ongoing', 'Payment Ongoing'),  # Collecting payments
        ('closed', 'Closed'),           # Everything locked
    ]

    month = models.IntegerField()
    year = models.IntegerField()
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='open'
    )
    generated_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_billing_cycles',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['month', 'year']
        ordering = ['-year', '-month']
        indexes = [
            models.Index(fields=['month', 'year']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"BillingCycle: {self.month}/{self.year} - {self.status}"

    @property
    def is_attendance_editable(self):
        """Attendance can only be edited when cycle is OPEN."""
        return self.status == 'open'

    @property
    def can_generate_bills(self):
        """Bills can only be generated when cycle is OPEN."""
        return self.status == 'open'

    @property
    def can_accept_payments(self):
        """Payments accepted in BILLED or PAYMENT_ONGOING status."""
        return self.status in ['billed', 'payment_ongoing']

    @property
    def is_locked(self):
        """Cycle is considered locked if not OPEN."""
        return self.status != 'open'


class Bill(models.Model):
    """Monthly mess bill for a student, calculated from attendance and rate."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('disputed', 'Disputed'),
        ('overdue', 'Overdue'),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bills',
    )
    month = models.IntegerField()
    year = models.IntegerField()
    lunch_days = models.IntegerField(default=0)
    dinner_days = models.IntegerField(default=0)
    lunch_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    dinner_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending'
    )
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='generated_bills',
    )
    generated_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = ['student', 'month', 'year']
        ordering = ['-year', '-month']
        indexes = [
            models.Index(fields=['student', 'month', 'year']),
            models.Index(fields=['status']),
            models.Index(fields=['month', 'year']),
            models.Index(fields=['student', 'status']),
        ]

    def __str__(self):
        return (
            f"Bill: {self.student.username} - "
            f"{self.month}/{self.year} - Rs.{self.total_amount}"
        )

    @property
    def days_present(self):
        """Total days with at least one meal."""
        return max(self.lunch_days, self.dinner_days)

    @property
    def rate_per_day(self):
        """Combined rate per day."""
        return self.lunch_rate + self.dinner_rate
