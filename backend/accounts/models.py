from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Custom User model with role-based access for Mess Billing System."""

    ROLE_CHOICES = (
        ('student', 'Student'),
        ('contractor', 'Contractor'),
        ('warden', 'Warden'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    phone = models.CharField(max_length=15, blank=True, null=True)
    enrollment_number = models.CharField(max_length=50, blank=True, null=True, unique=True)
    room_number = models.CharField(max_length=20, blank=True, null=True)
    hostel = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        ordering = ['username']

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

    @property
    def is_student(self):
        return self.role == 'student'

    @property
    def is_contractor(self):
        return self.role == 'contractor'

    @property
    def is_warden(self):
        return self.role == 'warden'
