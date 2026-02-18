from decimal import Decimal

from django.db.models import Sum, Q, Count
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from accounts.permissions import IsStudent, IsContractorOrWarden
from audit_logs.models import AuditLog
from billing.models import Bill
from .models import Payment
from .serializers import (
    PaymentSerializer,
    SubmitPaymentSerializer,
    VerifyPaymentSerializer,
)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class PaymentListCreateView(generics.ListCreateAPIView):
    """
    GET  - List payments with optional filters.
           Students see their own; contractors/wardens see all.
           Supports ordering by: roll_no, date, amount, status
    POST - Submit a new payment (students only).
    """

    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SubmitPaymentSerializer
        return PaymentSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsStudent()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = Payment.objects.select_related(
            'bill', 'student', 'verified_by'
        )

        if user.role == 'student':
            queryset = queryset.filter(student=user)

        payment_status = self.request.query_params.get('status')
        payment_method = self.request.query_params.get('method')
        bill_id = self.request.query_params.get('bill_id')
        student_id = self.request.query_params.get('student_id')
        search = self.request.query_params.get('search', '')

        if payment_status:
            queryset = queryset.filter(status=payment_status)
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)
        if bill_id:
            queryset = queryset.filter(bill_id=int(bill_id))
        if student_id and user.role != 'student':
            queryset = queryset.filter(student_id=int(student_id))
        if search and user.role != 'student':
            queryset = queryset.filter(
                Q(student__username__icontains=search) |
                Q(student__first_name__icontains=search) |
                Q(student__last_name__icontains=search) |
                Q(student__enrollment_number__icontains=search) |
                Q(transaction_id__icontains=search)
            )

        # Handle ordering via query params
        ordering = self.request.query_params.get('ordering', '')
        order_map = {
            'roll_no': 'student__enrollment_number',
            '-roll_no': '-student__enrollment_number',
            'date': 'payment_date',
            '-date': '-payment_date',
            'amount': 'amount',
            '-amount': '-amount',
            'status': 'status',
            '-status': '-status',
            'created_at': 'created_at',
            '-created_at': '-created_at',
        }

        if ordering and ordering in order_map:
            queryset = queryset.order_by(order_map[ordering])
        else:
            # Default: order by roll number ascending
            queryset = queryset.order_by('student__enrollment_number', '-created_at')

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bill = serializer.validated_data['bill']
        amount = serializer.validated_data['amount']

        # Calculate total already paid (verified payments)
        total_verified = (
            Payment.objects.filter(
                bill=bill, status='verified'
            ).aggregate(total=Sum('amount'))['total']
            or Decimal('0')
        )

        remaining = bill.total_amount - total_verified
        if amount > remaining:
            return Response(
                {
                    'detail': (
                        f'Payment amount (Rs.{amount}) exceeds remaining balance '
                        f'(Rs.{remaining}). Total bill: Rs.{bill.total_amount}, '
                        f'already verified: Rs.{total_verified}.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer.save(student=request.user, status='pending')

        payment = Payment.objects.select_related(
            'bill', 'student', 'verified_by'
        ).get(pk=serializer.instance.pk)

        return Response(
            PaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


class PaymentDetailView(generics.RetrieveAPIView):
    """Retrieve a single payment with full details."""

    serializer_class = PaymentSerializer
    queryset = Payment.objects.select_related(
        'bill', 'student', 'verified_by'
    )

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        if user.role == 'student' and obj.student != user:
            self.permission_denied(self.request)
        return obj


class SubmitPaymentView(generics.CreateAPIView):
    """
    Submit a new payment for a bill. Only students can submit payments.
    Validates the bill belongs to the student and amount does not exceed
    the remaining balance.
    """

    serializer_class = SubmitPaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def perform_create(self, serializer):
        serializer.save(student=self.request.user, status='pending')

    def create(self, request, *args, **kwargs):
        from billing.models import BillingCycle

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        bill = serializer.validated_data['bill']
        amount = serializer.validated_data['amount']

        # Check billing cycle status - cannot make payment if cycle is CLOSED
        try:
            cycle = BillingCycle.objects.get(month=bill.month, year=bill.year)
            if cycle.status == 'closed':
                return Response(
                    {'detail': f'Billing cycle for {bill.month}/{bill.year} is closed. No payments can be accepted.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except BillingCycle.DoesNotExist:
            pass  # No cycle means payment is allowed

        # Calculate total already paid (verified payments)
        total_verified = (
            Payment.objects.filter(
                bill=bill, status='verified'
            ).aggregate(
                total=Sum('amount')
            )['total']
            or Decimal('0')
        )

        # Calculate total pending
        total_pending = (
            Payment.objects.filter(
                bill=bill, status='pending'
            ).aggregate(
                total=Sum('amount')
            )['total']
            or Decimal('0')
        )

        remaining = bill.total_amount - total_verified
        if amount > remaining:
            return Response(
                {
                    'detail': (
                        f'Payment amount (Rs.{amount}) exceeds remaining balance '
                        f'(Rs.{remaining}). Total bill: Rs.{bill.total_amount}, '
                        f'already verified: Rs.{total_verified}.'
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        self.perform_create(serializer)

        # Return full payment details
        payment = Payment.objects.select_related(
            'bill', 'student', 'verified_by'
        ).get(pk=serializer.instance.pk)

        return Response(
            PaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


class VerifyPaymentView(APIView):
    """
    Verify or reject a payment. Accessible by contractors and wardens.
    When verified, if total verified payments >= bill amount, marks bill as 'paid'.
    POST body: { "status": "verified" or "rejected", "notes": "..." }
    """

    permission_classes = [permissions.IsAuthenticated, IsContractorOrWarden]

    def post(self, request, pk):
        try:
            payment = Payment.objects.select_related(
                'bill', 'student', 'verified_by'
            ).get(pk=pk)
        except Payment.DoesNotExist:
            return Response(
                {'detail': 'Payment not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if payment.status != 'pending':
            return Response(
                {'detail': f'Payment has already been {payment.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = VerifyPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('notes', '')

        old_status = payment.status
        payment.status = new_status
        payment.verified_by = request.user
        if notes:
            payment.notes = notes
        payment.save(update_fields=['status', 'verified_by', 'notes'])

        # Log the verification
        AuditLog.objects.create(
            user=request.user,
            user_role=request.user.role,
            action='verify' if new_status == 'verified' else 'reject',
            model_name='Payment',
            object_id=payment.id,
            old_values={'status': old_status},
            new_values={'status': new_status, 'notes': notes},
            description=f'{new_status.title()} payment #{payment.id} for Rs.{payment.amount}',
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        # If verified, check if bill is fully paid
        if new_status == 'verified':
            bill = payment.bill
            total_verified = (
                Payment.objects.filter(
                    bill=bill, status='verified'
                ).aggregate(total=Sum('amount'))['total']
                or Decimal('0')
            )
            if total_verified >= bill.total_amount:
                bill.status = 'paid'
                bill.save(update_fields=['status'])

        # Refresh from DB for accurate response
        payment.refresh_from_db()
        payment = Payment.objects.select_related(
            'bill', 'student', 'verified_by'
        ).get(pk=payment.pk)

        return Response(PaymentSerializer(payment).data)


class MyPaymentsView(generics.ListAPIView):
    """
    List the authenticated student's own payments.
    Enhanced with month/year filtering, sorting by date (newest first default).
    """

    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get_queryset(self):
        queryset = Payment.objects.filter(
            student=self.request.user
        ).select_related('bill', 'student', 'verified_by')

        payment_status = self.request.query_params.get('status')
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')

        if payment_status:
            queryset = queryset.filter(status=payment_status)
        if month:
            queryset = queryset.filter(bill__month=int(month))
        if year:
            queryset = queryset.filter(bill__year=int(year))

        # Default sort: date newest first
        ordering = self.request.query_params.get('ordering', '-payment_date')
        if ordering in ['-payment_date', 'payment_date', '-amount', 'amount', '-created_at', 'created_at']:
            queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by('-payment_date')

        return queryset


class RejectPaymentView(APIView):
    """
    Reject a pending payment. Accessible by contractors and wardens.
    POST body: { "notes": "reason for rejection" }
    """

    permission_classes = [permissions.IsAuthenticated, IsContractorOrWarden]

    def post(self, request, pk):
        try:
            payment = Payment.objects.select_related(
                'bill', 'student', 'verified_by'
            ).get(pk=pk)
        except Payment.DoesNotExist:
            return Response(
                {'detail': 'Payment not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if payment.status != 'pending':
            return Response(
                {'detail': f'Payment has already been {payment.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notes = request.data.get('notes', '')
        old_status = payment.status
        payment.status = 'rejected'
        payment.verified_by = request.user
        if notes:
            payment.notes = notes
        payment.save(update_fields=['status', 'verified_by', 'notes'])

        # Log the rejection
        AuditLog.objects.create(
            user=request.user,
            user_role=request.user.role,
            action='reject',
            model_name='Payment',
            object_id=payment.id,
            old_values={'status': old_status},
            new_values={'status': 'rejected', 'notes': notes},
            description=f'Rejected payment #{payment.id} for Rs.{payment.amount}',
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        payment = Payment.objects.select_related(
            'bill', 'student', 'verified_by'
        ).get(pk=payment.pk)

        return Response(PaymentSerializer(payment).data)


class PaymentSummaryView(APIView):
    """
    Get payment summary statistics for contractors.
    Supports filtering by month/year.
    """

    permission_classes = [permissions.IsAuthenticated, IsContractorOrWarden]

    def get(self, request):
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        queryset = Payment.objects.all()

        if month:
            queryset = queryset.filter(bill__month=int(month))
        if year:
            queryset = queryset.filter(bill__year=int(year))

        # Total collected (verified payments)
        total_collected = queryset.filter(status='verified').aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0')

        # Total pending
        total_pending = queryset.filter(status='pending').aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0')

        # Total rejected
        total_rejected = queryset.filter(status='rejected').aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0')

        # Counts
        total_payments = queryset.count()
        verified_count = queryset.filter(status='verified').count()
        pending_count = queryset.filter(status='pending').count()
        rejected_count = queryset.filter(status='rejected').count()

        # Collection rate based on bill amounts for the period
        bills_queryset = Bill.objects.all()
        if month:
            bills_queryset = bills_queryset.filter(month=int(month))
        if year:
            bills_queryset = bills_queryset.filter(year=int(year))

        total_billed = bills_queryset.aggregate(
            total=Sum('total_amount')
        )['total'] or Decimal('0')

        collection_rate = (
            round((float(total_collected) / float(total_billed)) * 100, 1)
            if total_billed > 0 else 0
        )

        # By payment method
        by_method = {}
        for method in ['cash', 'online', 'upi', 'cheque', 'other']:
            amount = queryset.filter(
                status='verified', payment_method=method
            ).aggregate(total=Sum('amount'))['total'] or 0
            by_method[method] = str(amount)

        return Response({
            'total_collected': str(total_collected),
            'total_pending': str(total_pending),
            'total_rejected': str(total_rejected),
            'total_billed': str(total_billed),
            'collection_rate': collection_rate,
            'counts': {
                'total': total_payments,
                'verified': verified_count,
                'pending': pending_count,
                'rejected': rejected_count,
            },
            'by_method': by_method,
        })


class StudentPaymentSummaryView(APIView):
    """
    Get payment summary statistics for students.
    Returns: total payments (current year), total paid lifetime.
    """

    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request):
        from datetime import date

        user = request.user
        today = date.today()
        current_year = today.year

        all_payments = Payment.objects.filter(student=user)
        verified_payments = all_payments.filter(status='verified')

        # Total payments (current year)
        current_year_paid = verified_payments.filter(
            payment_date__year=current_year
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

        # Total paid lifetime
        lifetime_paid = verified_payments.aggregate(
            total=Sum('amount')
        )['total'] or Decimal('0')

        # Payment counts
        total_payments = verified_payments.count()
        pending_payments = all_payments.filter(status='pending').count()
        rejected_payments = all_payments.filter(status='rejected').count()

        # By payment method
        by_method = {}
        for method in ['cash', 'online', 'upi', 'cheque', 'other']:
            amount = verified_payments.filter(
                payment_method=method
            ).aggregate(total=Sum('amount'))['total'] or 0
            if amount > 0:
                by_method[method] = str(amount)

        return Response({
            'current_year_paid': str(current_year_paid),
            'lifetime_paid': str(lifetime_paid),
            'counts': {
                'total_verified': total_payments,
                'pending': pending_payments,
                'rejected': rejected_payments,
            },
            'by_method': by_method,
        })


class ExportStudentPaymentsView(APIView):
    """
    Export the student's payment history to CSV.
    """

    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request):
        import csv
        from django.http import HttpResponse

        user = request.user
        payments = Payment.objects.filter(
            student=user
        ).select_related('bill').order_by('-payment_date')

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="payments_{user.username}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Payment ID', 'Bill Month', 'Bill Year', 'Amount',
            'Payment Method', 'Payment Date', 'Status',
            'Transaction ID', 'Notes'
        ])

        for payment in payments:
            writer.writerow([
                payment.id,
                payment.bill.month if payment.bill else '',
                payment.bill.year if payment.bill else '',
                payment.amount,
                payment.payment_method,
                payment.payment_date.strftime('%Y-%m-%d') if payment.payment_date else '',
                payment.status,
                payment.transaction_id or '',
                payment.notes or '',
            ])

        return response
