from django.db import models
from django.conf import settings


class MessRate(models.Model):
    """Mess rate configuration for a given month/year with separate lunch and dinner rates."""

    month = models.IntegerField()
    year = models.IntegerField()
    lunch_rate = models.DecimalField(max_digits=10, decimal_places=2)
    dinner_rate = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['month', 'year']
        ordering = ['-year', '-month']

    def __str__(self):
        return f"Rate: Lunch Rs.{self.lunch_rate} + Dinner Rs.{self.dinner_rate} for {self.month}/{self.year}"


class Attendance(models.Model):
    """Daily attendance record for a student with separate lunch and dinner tracking."""

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attendance_records',
    )
    date = models.DateField()
    lunch = models.BooleanField(default=False)
    dinner = models.BooleanField(default=False)
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='marked_attendance',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)
    modification_reason = models.TextField(blank=True, null=True)

    class Meta:
        unique_together = ['student', 'date']
        ordering = ['-date']
        indexes = [
            models.Index(fields=['student', 'date']),
            models.Index(fields=['date']),
            models.Index(fields=['student', 'date', 'lunch', 'dinner']),
        ]

    def __str__(self):
        meals = []
        if self.lunch:
            meals.append("Lunch")
        if self.dinner:
            meals.append("Dinner")
        status = " + ".join(meals) if meals else "Absent"
        return f"{self.student.username} - {self.date} - {status}"
