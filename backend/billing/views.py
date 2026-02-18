from datetime import date, timedelta
from decimal import Decimal
import csv

from django.http import HttpResponse
from django.db.models import Q, Sum, Count
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from accounts.models import User
from accounts.permissions import (
    IsContractor,
    IsContractorOrWarden,
    IsStudent,
)
from attendance.models import Attendance, MessRate
from audit_logs.models import AuditLog
from .models import Bill, BillingCycle
from .serializers import BillSerializer, GenerateBillsSerializer, BillingCycleSerializer


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class BillListView(generics.ListAPIView):
    """
    List bills with optional filters for month, year, status, and student.
    Contractors/wardens see all bills; students see only their own.
    Supports search by roll no or student name.
    """

    serializer_class = BillSerializer
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        user = self.request.user
        queryset = Bill.objects.select_related(
            'student', 'generated_by'
        )

        # Students can only see their own bills
        if user.role == 'student':
            queryset = queryset.filter(student=user)

        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        bill_status = self.request.query_params.get('status')
        student_id = self.request.query_params.get('student_id')
        search = self.request.query_params.get('search', '')

        if month:
            queryset = queryset.filter(month=int(month))
        if year:
            queryset = queryset.filter(year=int(year))
        if bill_status:
            queryset = queryset.filter(status=bill_status)
        if student_id and user.role != 'student':
            queryset = queryset.filter(student_id=int(student_id))
        if search and user.role != 'student':
            queryset = queryset.filter(
                Q(student__username__icontains=search) |
                Q(student__first_name__icontains=search) |
                Q(student__last_name__icontains=search) |
                Q(student__enrollment_number__icontains=search)
            )

        # Support ordering
        ordering = self.request.query_params.get('ordering', '-year,-month')
        if ordering:
            order_fields = [f.strip() for f in ordering.split(',')]
            queryset = queryset.order_by(*order_fields)

        return queryset


class BillDetailView(generics.RetrieveUpdateAPIView):
    """
    Retrieve or update a bill. Only contractors/wardens can update.
    Students can only view their own bill.
    """

    serializer_class = BillSerializer
    queryset = Bill.objects.select_related('student', 'generated_by')

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [permissions.IsAuthenticated(), IsContractorOrWarden()]
        return [permissions.IsAuthenticated()]

    def get_object(self):
        obj = super().get_object()
        # Students can only access their own bills
        if (
            self.request.user.role == 'student'
            and obj.student != self.request.user
        ):
            self.permission_denied(self.request)
        return obj


class GenerateBillsView(APIView):
    """
    Generate monthly bills for all students based on attendance and mess rate.
    Accessible by contractors only.

    POST body: { "month": 1, "year": 2025, "due_date": "2025-02-15" (optional) }

    Logic:
    - Check billing cycle status (must be OPEN)
    - Fetch the MessRate for the given month/year.
    - For each student, count lunch_days and dinner_days from Attendance records.
    - total_amount = lunch_days * lunch_rate + dinner_days * dinner_rate.
    - Create or update the Bill record.
    - Update billing cycle status to BILLED.
    """

    permission_classes = [permissions.IsAuthenticated, IsContractor]

    def post(self, request):
        serializer = GenerateBillsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        month = serializer.validated_data['month']
        year = serializer.validated_data['year']
        due_date = serializer.validated_data.get('due_date')

        # Get or create billing cycle and check status
        cycle, _ = BillingCycle.objects.get_or_create(
            month=month,
            year=year,
            defaults={'created_by': request.user}
        )

        if not cycle.can_generate_bills:
            return Response(
                {
                    'detail': (
                        f'Billing cycle for {month}/{year} is {cycle.status}. '
                        'Bills can only be generated when cycle is OPEN.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Default due date: 15th of the next month
        if not due_date:
            if month == 12:
                due_date = date(year + 1, 1, 15)
            else:
                due_date = date(year, month + 1, 15)

        # Get the mess rate for this period
        try:
            mess_rate = MessRate.objects.get(month=month, year=year, is_active=True)
        except MessRate.DoesNotExist:
            return Response(
                {
                    'detail': (
                        f'No active mess rate found for {month}/{year}. '
                        'Please create a mess rate first.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        lunch_rate = mess_rate.lunch_rate
        dinner_rate = mess_rate.dinner_rate
        students = User.objects.filter(role='student')

        if not students.exists():
            return Response(
                {'detail': 'No students found in the system.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_count = 0
        updated_count = 0
        bills_data = []

        for student in students:
            attendance_qs = Attendance.objects.filter(
                student=student,
                date__month=month,
                date__year=year,
            )
            lunch_days = attendance_qs.filter(lunch=True).count()
            dinner_days = attendance_qs.filter(dinner=True).count()

            total_amount = (
                Decimal(lunch_days) * lunch_rate
                + Decimal(dinner_days) * dinner_rate
            )

            bill, was_created = Bill.objects.update_or_create(
                student=student,
                month=month,
                year=year,
                defaults={
                    'lunch_days': lunch_days,
                    'dinner_days': dinner_days,
                    'lunch_rate': lunch_rate,
                    'dinner_rate': dinner_rate,
                    'total_amount': total_amount,
                    'generated_by': request.user,
                    'due_date': due_date,
                },
            )

            if was_created:
                created_count += 1
            else:
                updated_count += 1

            bills_data.append(BillSerializer(bill).data)

        # Update billing cycle status to BILLED
        cycle.status = 'billed'
        cycle.generated_at = timezone.now()
        cycle.save()

        # Calculate total revenue
        total_revenue = sum(
            Decimal(b['total_amount']) for b in bills_data
        )

        # Log the bill generation
        AuditLog.objects.create(
            user=request.user,
            user_role=request.user.role,
            action='generate',
            model_name='Bill',
            object_id=None,
            old_values={},
            new_values={
                'month': month,
                'year': year,
                'total_students': len(bills_data),
                'total_revenue': str(total_revenue),
            },
            description=f'Generated {len(bills_data)} bills for {month}/{year}. Total revenue: Rs {total_revenue}',
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        return Response(
            {
                'detail': (
                    f'Bills generated for {month}/{year}. '
                    f'{created_count} created, {updated_count} updated.'
                ),
                'month': month,
                'year': year,
                'lunch_rate': str(lunch_rate),
                'dinner_rate': str(dinner_rate),
                'total_students': len(bills_data),
                'created': created_count,
                'updated': updated_count,
                'total_revenue': str(total_revenue),
                'billing_cycle_status': cycle.status,
                'bills': bills_data,
            },
            status=status.HTTP_200_OK,
        )


class ExportBillsView(APIView):
    """Export bills to CSV format."""

    permission_classes = [permissions.IsAuthenticated, IsContractorOrWarden]

    def get(self, request):
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        bill_status = request.query_params.get('status')

        queryset = Bill.objects.select_related('student').order_by(
            'student__enrollment_number', '-year', '-month'
        )

        if month:
            queryset = queryset.filter(month=int(month))
        if year:
            queryset = queryset.filter(year=int(year))
        if bill_status:
            queryset = queryset.filter(status=bill_status)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="bills_export_{date.today()}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Serial No', 'Roll No', 'Student Name', 'Hostel', 'Room',
            'Month', 'Year', 'Lunch Days', 'Dinner Days', 'Days Present',
            'Lunch Rate', 'Dinner Rate', 'Total Amount', 'Status', 'Due Date'
        ])

        for idx, bill in enumerate(queryset, 1):
            writer.writerow([
                idx,
                bill.student.enrollment_number or '',
                bill.student.get_full_name() or bill.student.username,
                bill.student.hostel or '',
                bill.student.room_number or '',
                bill.month,
                bill.year,
                bill.lunch_days,
                bill.dinner_days,
                max(bill.lunch_days, bill.dinner_days),
                bill.lunch_rate,
                bill.dinner_rate,
                bill.total_amount,
                bill.status,
                bill.due_date or '',
            ])

        return response


class MyBillsView(generics.ListAPIView):
    """List the authenticated student's own bills."""

    serializer_class = BillSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get_queryset(self):
        queryset = Bill.objects.filter(
            student=self.request.user
        ).select_related('student', 'generated_by')

        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        bill_status = self.request.query_params.get('status')

        if month:
            queryset = queryset.filter(month=int(month))
        if year:
            queryset = queryset.filter(year=int(year))
        if bill_status:
            queryset = queryset.filter(status=bill_status)

        return queryset


# ---------------------------------------------------------------------------
# Billing Cycle Management Views
# ---------------------------------------------------------------------------


class BillingCycleListCreateView(generics.ListCreateAPIView):
    """
    GET - List all billing cycles.
    POST - Create a new billing cycle (contractor only).
    """

    serializer_class = BillingCycleSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsContractor()]
        return [permissions.IsAuthenticated(), IsContractorOrWarden()]

    def get_queryset(self):
        queryset = BillingCycle.objects.select_related('created_by')
        year = self.request.query_params.get('year')
        status_filter = self.request.query_params.get('status')

        if year:
            queryset = queryset.filter(year=int(year))
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class BillingCycleDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update a billing cycle."""

    serializer_class = BillingCycleSerializer
    queryset = BillingCycle.objects.select_related('created_by')

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [permissions.IsAuthenticated(), IsContractor()]
        return [permissions.IsAuthenticated(), IsContractorOrWarden()]


class BillingCycleStatusView(APIView):
    """Update the status of a billing cycle with validation."""

    permission_classes = [permissions.IsAuthenticated, IsContractor]

    def post(self, request, pk):
        try:
            cycle = BillingCycle.objects.get(pk=pk)
        except BillingCycle.DoesNotExist:
            return Response(
                {'detail': 'Billing cycle not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        new_status = request.data.get('status')
        valid_statuses = [s[0] for s in BillingCycle.STATUS_CHOICES]

        if new_status not in valid_statuses:
            return Response(
                {'detail': f'Invalid status. Must be one of: {valid_statuses}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = cycle.status

        # Validate status transitions
        valid_transitions = {
            'open': ['billed'],
            'billed': ['payment_ongoing', 'closed'],
            'payment_ongoing': ['closed'],
            'closed': [],  # Cannot transition from closed
        }

        if new_status not in valid_transitions.get(old_status, []):
            return Response(
                {'detail': f'Cannot transition from {old_status} to {new_status}.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        cycle.status = new_status
        if new_status == 'closed':
            cycle.closed_at = timezone.now()
        cycle.save()

        # Log the action
        AuditLog.objects.create(
            user=request.user,
            user_role=request.user.role,
            action='update',
            model_name='BillingCycle',
            object_id=cycle.id,
            old_values={'status': old_status},
            new_values={'status': new_status},
            description=f'Billing cycle {cycle.month}/{cycle.year} status changed from {old_status} to {new_status}',
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        return Response(BillingCycleSerializer(cycle).data)


class CurrentBillingCycleView(APIView):
    """Get or create the current month's billing cycle."""

    permission_classes = [permissions.IsAuthenticated, IsContractorOrWarden]

    def get(self, request):
        today = date.today()
        month = int(request.query_params.get('month', today.month))
        year = int(request.query_params.get('year', today.year))

        cycle, created = BillingCycle.objects.get_or_create(
            month=month,
            year=year,
            defaults={'created_by': request.user}
        )

        return Response(BillingCycleSerializer(cycle).data)


# ---------------------------------------------------------------------------
# Bill Summary & Preview Views
# ---------------------------------------------------------------------------


class BillSummaryView(APIView):
    """
    Get summary statistics for bills (Total Revenue, Paid, Pending, Overdue).
    Used for the top summary section in Bills page.
    """

    permission_classes = [permissions.IsAuthenticated, IsContractorOrWarden]

    def get(self, request):
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        queryset = Bill.objects.all()

        if month:
            queryset = queryset.filter(month=int(month))
        if year:
            queryset = queryset.filter(year=int(year))

        # Aggregate statistics
        total_revenue = queryset.aggregate(total=Sum('total_amount'))['total'] or 0
        paid_amount = queryset.filter(status='paid').aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        pending_amount = queryset.filter(status='pending').aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        overdue_amount = queryset.filter(status='overdue').aggregate(
            total=Sum('total_amount')
        )['total'] or 0
        disputed_amount = queryset.filter(status='disputed').aggregate(
            total=Sum('total_amount')
        )['total'] or 0

        # Counts
        total_bills = queryset.count()
        paid_count = queryset.filter(status='paid').count()
        pending_count = queryset.filter(status='pending').count()
        overdue_count = queryset.filter(status='overdue').count()
        disputed_count = queryset.filter(status='disputed').count()

        # Get billing cycle status if month/year specified
        billing_cycle = None
        if month and year:
            try:
                cycle = BillingCycle.objects.get(month=int(month), year=int(year))
                billing_cycle = {
                    'id': cycle.id,
                    'status': cycle.status,
                    'is_locked': cycle.is_locked,
                    'generated_at': cycle.generated_at,
                }
            except BillingCycle.DoesNotExist:
                pass

        return Response({
            'total_revenue': str(total_revenue),
            'paid_amount': str(paid_amount),
            'pending_amount': str(pending_amount),
            'overdue_amount': str(overdue_amount),
            'disputed_amount': str(disputed_amount),
            'total_bills': total_bills,
            'paid_count': paid_count,
            'pending_count': pending_count,
            'overdue_count': overdue_count,
            'disputed_count': disputed_count,
            'collection_rate': round((float(paid_amount) / float(total_revenue)) * 100, 1) if total_revenue > 0 else 0,
            'billing_cycle': billing_cycle,
        })


class BillPreviewView(APIView):
    """
    Preview bill generation before actually generating.
    Shows student count, estimated revenue, active rate.
    """

    permission_classes = [permissions.IsAuthenticated, IsContractor]

    def post(self, request):
        serializer = GenerateBillsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        month = serializer.validated_data['month']
        year = serializer.validated_data['year']

        # Check billing cycle status
        try:
            cycle = BillingCycle.objects.get(month=month, year=year)
            if not cycle.can_generate_bills:
                return Response({
                    'can_generate': False,
                    'reason': f'Billing cycle is {cycle.status}. Bills can only be generated in OPEN status.',
                    'billing_cycle': BillingCycleSerializer(cycle).data,
                }, status=status.HTTP_400_BAD_REQUEST)
        except BillingCycle.DoesNotExist:
            # Will be created during generation
            pass

        # Check if bills already exist for this period
        existing_bills = Bill.objects.filter(month=month, year=year).count()

        # Get the mess rate for this period
        try:
            mess_rate = MessRate.objects.get(month=month, year=year, is_active=True)
        except MessRate.DoesNotExist:
            return Response({
                'can_generate': False,
                'reason': f'No active mess rate found for {month}/{year}. Please create a mess rate first.',
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get student count and preview calculations
        students = User.objects.filter(role='student')
        student_count = students.count()

        if student_count == 0:
            return Response({
                'can_generate': False,
                'reason': 'No students found in the system.',
            }, status=status.HTTP_400_BAD_REQUEST)

        # Calculate estimated revenue based on attendance
        total_lunch_days = 0
        total_dinner_days = 0

        for student in students:
            attendance_qs = Attendance.objects.filter(
                student=student,
                date__month=month,
                date__year=year,
            )
            total_lunch_days += attendance_qs.filter(lunch=True).count()
            total_dinner_days += attendance_qs.filter(dinner=True).count()

        estimated_revenue = (
            Decimal(total_lunch_days) * mess_rate.lunch_rate +
            Decimal(total_dinner_days) * mess_rate.dinner_rate
        )

        return Response({
            'can_generate': True,
            'month': month,
            'year': year,
            'student_count': student_count,
            'total_lunch_days': total_lunch_days,
            'total_dinner_days': total_dinner_days,
            'lunch_rate': str(mess_rate.lunch_rate),
            'dinner_rate': str(mess_rate.dinner_rate),
            'estimated_revenue': str(estimated_revenue),
            'existing_bills': existing_bills,
            'will_update': existing_bills > 0,
        })


# ---------------------------------------------------------------------------
# Student-Specific Bill Views
# ---------------------------------------------------------------------------


class StudentBillSummaryView(APIView):
    """
    Get bill summary statistics for the logged-in student.
    Returns: total paid (current year), total pending, average monthly bill.
    """

    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request):
        from payments.models import Payment

        user = request.user
        today = date.today()
        current_year = today.year

        all_bills = Bill.objects.filter(student=user)

        # Total paid (current year) - verified payments
        current_year_paid = Payment.objects.filter(
            bill__student=user,
            status='verified',
            payment_date__year=current_year
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Total pending - bills that are pending or overdue
        pending_bills = all_bills.filter(status__in=['pending', 'overdue'])
        total_pending = pending_bills.aggregate(total=Sum('total_amount'))['total'] or 0

        # Calculate paid amount from verified payments for pending bills
        for bill in pending_bills:
            paid = Payment.objects.filter(
                bill=bill, status='verified'
            ).aggregate(total=Sum('amount'))['total'] or 0
            remaining = float(bill.total_amount) - float(paid)
            total_pending = sum([
                float(b.total_amount) - float(
                    Payment.objects.filter(
                        bill=b, status='verified'
                    ).aggregate(total=Sum('amount'))['total'] or 0
                )
                for b in pending_bills
            ])

        # Average monthly bill
        total_bills_count = all_bills.count()
        total_billed = all_bills.aggregate(total=Sum('total_amount'))['total'] or 0
        avg_monthly_bill = (
            float(total_billed) / total_bills_count
            if total_bills_count > 0 else 0
        )

        # Overdue info
        overdue_bills = all_bills.filter(
            Q(status='overdue') | Q(status='pending', due_date__lt=today)
        )
        overdue_count = overdue_bills.count()
        overdue_amount = sum([
            float(b.total_amount) - float(
                Payment.objects.filter(
                    bill=b, status='verified'
                ).aggregate(total=Sum('amount'))['total'] or 0
            )
            for b in overdue_bills
        ])

        return Response({
            'current_year_paid': float(current_year_paid),
            'total_pending': float(total_pending) if total_pending > 0 else 0,
            'avg_monthly_bill': round(avg_monthly_bill, 2),
            'total_bills': total_bills_count,
            'overdue_count': overdue_count,
            'overdue_amount': float(overdue_amount) if overdue_amount > 0 else 0,
        })


class StudentBillDetailView(APIView):
    """
    Get detailed bill information for a specific bill.
    Includes payment history, dispute info, and eligibility checks.
    """

    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request, pk):
        from payments.models import Payment
        from disputes.models import Dispute
        from .serializers import BillDetailSerializer

        try:
            bill = Bill.objects.select_related(
                'student', 'generated_by'
            ).get(pk=pk, student=request.user)
        except Bill.DoesNotExist:
            return Response(
                {'detail': 'Bill not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = BillDetailSerializer(bill)
        return Response(serializer.data)
