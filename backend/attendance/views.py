import calendar
from datetime import date

from django.db.models import Count, Q, Sum, Case, When, IntegerField
from django.db.models.functions import Coalesce
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from accounts.models import User
from accounts.permissions import IsContractor, IsContractorOrWarden, IsWardenOrAdmin
from audit_logs.models import AuditLog
from billing.models import BillingCycle
from .models import MessRate, Attendance
from .serializers import (
    MessRateSerializer,
    AttendanceSerializer,
    BulkAttendanceSerializer,
    AttendanceSummarySerializer,
)


# ---------------------------------------------------------------------------
# Mess Rate Views
# ---------------------------------------------------------------------------


class MessRateListCreateView(generics.ListCreateAPIView):
    """
    GET  - List all mess rates (any authenticated user).
    POST - Create a new mess rate (contractor only).
    """

    serializer_class = MessRateSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsContractor()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = MessRate.objects.all()
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        if month:
            queryset = queryset.filter(month=month)
        if year:
            queryset = queryset.filter(year=year)
        return queryset

    def perform_create(self, serializer):
        instance = serializer.save(created_by=self.request.user)
        # Log the creation
        AuditLog.objects.create(
            user=self.request.user,
            user_role=self.request.user.role,
            action='create',
            model_name='MessRate',
            object_id=instance.id,
            new_values={
                'month': instance.month,
                'year': instance.year,
                'lunch_rate': str(instance.lunch_rate),
                'dinner_rate': str(instance.dinner_rate),
            },
            description=f'Created mess rate for {instance.month}/{instance.year}: Lunch Rs.{instance.lunch_rate}, Dinner Rs.{instance.dinner_rate}',
            ip_address=self.request.META.get('REMOTE_ADDR'),
        )


class MessRateDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete a mess rate (contractor only for writes)."""

    serializer_class = MessRateSerializer
    queryset = MessRate.objects.all()

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [permissions.IsAuthenticated(), IsContractor()]
        return [permissions.IsAuthenticated()]

    def perform_update(self, serializer):
        old_instance = self.get_object()
        old_values = {
            'lunch_rate': str(old_instance.lunch_rate),
            'dinner_rate': str(old_instance.dinner_rate),
            'is_active': old_instance.is_active,
        }
        instance = serializer.save()
        new_values = {
            'lunch_rate': str(instance.lunch_rate),
            'dinner_rate': str(instance.dinner_rate),
            'is_active': instance.is_active,
        }
        # Log the update
        AuditLog.objects.create(
            user=self.request.user,
            user_role=self.request.user.role,
            action='update',
            model_name='MessRate',
            object_id=instance.id,
            old_values=old_values,
            new_values=new_values,
            description=f'Updated mess rate for {instance.month}/{instance.year}',
            ip_address=self.request.META.get('REMOTE_ADDR'),
        )

    def perform_destroy(self, instance):
        # Log before deleting
        AuditLog.objects.create(
            user=self.request.user,
            user_role=self.request.user.role,
            action='delete',
            model_name='MessRate',
            object_id=instance.id,
            old_values={
                'month': instance.month,
                'year': instance.year,
                'lunch_rate': str(instance.lunch_rate),
                'dinner_rate': str(instance.dinner_rate),
            },
            description=f'Deleted mess rate for {instance.month}/{instance.year}',
            ip_address=self.request.META.get('REMOTE_ADDR'),
        )
        instance.delete()


class ActiveMessRateView(APIView):
    """Return the currently active mess rate (latest active entry)."""

    def get(self, request):
        today = date.today()
        rate = MessRate.objects.filter(
            month=today.month, year=today.year, is_active=True
        ).first()
        if not rate:
            rate = MessRate.objects.filter(is_active=True).first()
        if not rate:
            return Response(
                {'detail': 'No active mess rate found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(MessRateSerializer(rate).data)


# ---------------------------------------------------------------------------
# Attendance Views
# ---------------------------------------------------------------------------


class AttendanceListCreateView(generics.ListCreateAPIView):
    """
    GET  - List attendance records with filters.
    POST - Mark attendance for a single student (contractor/warden).
    """

    serializer_class = AttendanceSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsContractorOrWarden()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        queryset = Attendance.objects.select_related('student', 'marked_by')
        student_id = self.request.query_params.get('student_id')
        date_param = self.request.query_params.get('date')
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        lunch = self.request.query_params.get('lunch')
        dinner = self.request.query_params.get('dinner')

        if student_id:
            queryset = queryset.filter(student_id=student_id)
        if date_param:
            queryset = queryset.filter(date=date_param)
        if month:
            queryset = queryset.filter(date__month=month)
        if year:
            queryset = queryset.filter(date__year=year)
        if lunch is not None:
            queryset = queryset.filter(lunch=lunch.lower() == 'true')
        if dinner is not None:
            queryset = queryset.filter(dinner=dinner.lower() == 'true')
        return queryset

    def perform_create(self, serializer):
        serializer.save(marked_by=self.request.user)


class AttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update, or delete an attendance record."""

    serializer_class = AttendanceSerializer
    queryset = Attendance.objects.select_related('student', 'marked_by')

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH', 'DELETE'):
            return [permissions.IsAuthenticated(), IsContractorOrWarden()]
        return [permissions.IsAuthenticated()]

    def check_billing_cycle(self, attendance_date):
        """Check if billing cycle allows attendance modification."""
        month = attendance_date.month
        year = attendance_date.year
        try:
            cycle = BillingCycle.objects.get(month=month, year=year)
            if not cycle.is_attendance_editable:
                return False, f'Billing cycle for {month}/{year} is {cycle.status}. Attendance is locked.'
        except BillingCycle.DoesNotExist:
            pass  # No cycle means attendance is editable
        return True, None

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        can_edit, error_msg = self.check_billing_cycle(instance.date)
        if not can_edit:
            return Response(
                {'detail': error_msg, 'billing_locked': True},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Store old values for audit logging
        old_values = {
            'lunch': instance.lunch,
            'dinner': instance.dinner,
            'student_id': instance.student_id,
            'date': str(instance.date),
        }
        response = super().update(request, *args, **kwargs)
        # Log the update
        instance.refresh_from_db()
        AuditLog.objects.create(
            user=request.user,
            user_role=request.user.role,
            action='update',
            model_name='Attendance',
            object_id=instance.id,
            old_values=old_values,
            new_values={
                'lunch': instance.lunch,
                'dinner': instance.dinner,
                'student_id': instance.student_id,
                'date': str(instance.date),
            },
            description=f'Updated attendance for student #{instance.student_id} on {instance.date}',
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return response

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        can_edit, error_msg = self.check_billing_cycle(instance.date)
        if not can_edit:
            return Response(
                {'detail': error_msg, 'billing_locked': True},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Log before deletion
        AuditLog.objects.create(
            user=request.user,
            user_role=request.user.role,
            action='delete',
            model_name='Attendance',
            object_id=instance.id,
            old_values={
                'lunch': instance.lunch,
                'dinner': instance.dinner,
                'student_id': instance.student_id,
                'date': str(instance.date),
            },
            description=f'Deleted attendance for student #{instance.student_id} on {instance.date}',
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return super().destroy(request, *args, **kwargs)

    def perform_update(self, serializer):
        serializer.save(marked_by=self.request.user)


class BulkAttendanceView(APIView):
    """
    Mark attendance for multiple students at once.
    Expects: { "date": "YYYY-MM-DD", "students": [{"student_id": 1, "lunch": true, "dinner": false}, ...] }
    """

    permission_classes = [permissions.IsAuthenticated, IsContractorOrWarden]

    def post(self, request):
        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        attendance_date = serializer.validated_data['date']
        students_data = serializer.validated_data['students']

        # Check billing cycle status
        month = attendance_date.month
        year = attendance_date.year
        try:
            cycle = BillingCycle.objects.get(month=month, year=year)
            if not cycle.is_attendance_editable:
                return Response(
                    {
                        'detail': f'Billing cycle for {month}/{year} is {cycle.status}. Attendance is locked.',
                        'billing_locked': True,
                        'billing_cycle_status': cycle.status,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except BillingCycle.DoesNotExist:
            pass  # No cycle means attendance is editable

        created = 0
        updated = 0
        errors = []

        for entry in students_data:
            student_id = entry.get('student_id')
            lunch = entry.get('lunch', False)
            dinner = entry.get('dinner', False)

            try:
                student = User.objects.get(id=student_id, role='student')
            except User.DoesNotExist:
                errors.append(
                    f"Student with id {student_id} not found or is not a student."
                )
                continue

            attendance, was_created = Attendance.objects.update_or_create(
                student=student,
                date=attendance_date,
                defaults={
                    'lunch': lunch,
                    'dinner': dinner,
                    'marked_by': request.user,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        return Response(
            {
                'date': str(attendance_date),
                'created': created,
                'updated': updated,
                'errors': errors,
            },
            status=status.HTTP_200_OK,
        )


class AttendanceSummaryView(APIView):
    """
    Return attendance summary for all students for a given month/year.
    Query params: month (required), year (required), search (optional).
    Uses efficient Django ORM aggregation.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        search = request.query_params.get('search', '')

        if not month or not year:
            return Response(
                {'detail': 'Both month and year query parameters are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            month = int(month)
            year = int(year)
        except (ValueError, TypeError):
            return Response(
                {'detail': 'month and year must be integers.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total_days_in_month = calendar.monthrange(year, month)[1]
        
        # Base queryset with search filter
        students = User.objects.filter(role='student')
        if search:
            students = students.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(enrollment_number__icontains=search)
            )

        # Use efficient aggregation with Django ORM
        summaries = students.annotate(
            lunch_days=Coalesce(
                Sum(
                    Case(
                        When(attendance_records__date__month=month, 
                             attendance_records__date__year=year,
                             attendance_records__lunch=True, then=1),
                        default=0,
                        output_field=IntegerField()
                    )
                ), 0
            ),
            dinner_days=Coalesce(
                Sum(
                    Case(
                        When(attendance_records__date__month=month,
                             attendance_records__date__year=year,
                             attendance_records__dinner=True, then=1),
                        default=0,
                        output_field=IntegerField()
                    )
                ), 0
            ),
            both_days=Coalesce(
                Sum(
                    Case(
                        When(attendance_records__date__month=month,
                             attendance_records__date__year=year,
                             attendance_records__lunch=True,
                             attendance_records__dinner=True, then=1),
                        default=0,
                        output_field=IntegerField()
                    )
                ), 0
            ),
            absent_days=Coalesce(
                Sum(
                    Case(
                        When(attendance_records__date__month=month,
                             attendance_records__date__year=year,
                             attendance_records__lunch=False,
                             attendance_records__dinner=False, then=1),
                        default=0,
                        output_field=IntegerField()
                    )
                ), 0
            ),
            total_days=Count(
                'attendance_records',
                filter=Q(
                    attendance_records__date__month=month,
                    attendance_records__date__year=year
                )
            )
        ).order_by('enrollment_number', 'username')

        result = []
        for idx, student in enumerate(summaries, 1):
            # Calculate present days (days with at least one meal)
            present_days = student.lunch_days + student.dinner_days - student.both_days
            if present_days < 0:
                present_days = max(student.lunch_days, student.dinner_days)
            
            result.append({
                'serial_no': idx,
                'student_id': student.id,
                'student_name': student.get_full_name() or student.username,
                'student_username': student.username,
                'student_enrollment': student.enrollment_number or '',
                'hostel': student.hostel or '',
                'room_number': student.room_number or '',
                'total_days': student.total_days,
                'lunch_days': student.lunch_days,
                'dinner_days': student.dinner_days,
                'both_days': student.both_days,
                'absent_days': total_days_in_month - present_days if present_days > 0 else total_days_in_month,
                'present_days': present_days,
            })

        return Response({
            'month': month,
            'year': year,
            'total_days_in_month': total_days_in_month,
            'total_students': len(result),
            'summaries': result,
        })


class StudentAttendanceDetailView(APIView):
    """
    Return detailed attendance records for a specific student.
    Used by warden to view calendar/detail view per student.
    Query params: month (required), year (required), student_id (required).
    """

    permission_classes = [permissions.IsAuthenticated, IsWardenOrAdmin]

    def get(self, request):
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        student_id = request.query_params.get('student_id')

        if not all([month, year, student_id]):
            return Response(
                {'detail': 'month, year, and student_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            month = int(month)
            year = int(year)
            student_id = int(student_id)
        except (ValueError, TypeError):
            return Response(
                {'detail': 'Invalid parameter values.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            student = User.objects.get(id=student_id, role='student')
        except User.DoesNotExist:
            return Response(
                {'detail': 'Student not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        total_days_in_month = calendar.monthrange(year, month)[1]

        # Get attendance records for the student
        records = Attendance.objects.filter(
            student=student,
            date__month=month,
            date__year=year
        ).select_related('marked_by').order_by('date')

        # Calculate summary using aggregation
        summary = records.aggregate(
            lunch_days=Count('id', filter=Q(lunch=True)),
            dinner_days=Count('id', filter=Q(dinner=True)),
            both_days=Count('id', filter=Q(lunch=True, dinner=True)),
            absent_days=Count('id', filter=Q(lunch=False, dinner=False)),
        )

        serialized_records = AttendanceSerializer(records, many=True).data

        return Response({
            'student': {
                'id': student.id,
                'name': student.get_full_name() or student.username,
                'username': student.username,
                'enrollment_number': student.enrollment_number or '',
                'hostel': student.hostel or '',
                'room_number': student.room_number or '',
            },
            'month': month,
            'year': year,
            'total_days_in_month': total_days_in_month,
            'summary': summary,
            'records': serialized_records,
        })


class MyAttendanceView(APIView):
    """
    Return the authenticated student's own attendance records.
    Optional query params: month, year.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != 'student':
            return Response(
                {'detail': 'Only students can view their own attendance.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        queryset = Attendance.objects.filter(
            student=request.user
        ).select_related('marked_by').order_by('-date')

        month = request.query_params.get('month')
        year = request.query_params.get('year')

        if month:
            queryset = queryset.filter(date__month=int(month))
        if year:
            queryset = queryset.filter(date__year=int(year))

        records = AttendanceSerializer(queryset, many=True).data

        # Calculate summary
        total = queryset.count()
        lunch_days = queryset.filter(lunch=True).count()
        dinner_days = queryset.filter(dinner=True).count()
        both_days = queryset.filter(lunch=True, dinner=True).count()
        absent_days = queryset.filter(lunch=False, dinner=False).count()

        return Response({
            'summary': {
                'total_days': total,
                'lunch_days': lunch_days,
                'dinner_days': dinner_days,
                'both_days': both_days,
                'absent_days': absent_days,
            },
            'records': records,
        })
