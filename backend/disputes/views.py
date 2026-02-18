from django.db.models import Q, Count, Avg, F
from django.db.models.functions import Extract
from django.utils import timezone

from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsStudent, IsContractor, IsContractorOrWarden, IsWarden
from audit_logs.models import AuditLog
from billing.models import Bill
from .models import Dispute
from .serializers import (
    DisputeSerializer,
    CreateDisputeSerializer,
    ContractorResponseSerializer,
    ResolveDisputeSerializer,
)


class DisputeListCreateView(generics.ListCreateAPIView):
    """
    GET  - List disputes with optional status filter.
           Students see their own; contractors/wardens see all.
    POST - Create a new dispute (students only).
    """

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateDisputeSerializer
        return DisputeSerializer

    def get_permissions(self):
        if self.request.method == 'POST':
            return [permissions.IsAuthenticated(), IsStudent()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        queryset = Dispute.objects.select_related(
            'bill', 'bill__student', 'raised_by', 'resolved_by'
        )

        if user.role == 'student':
            queryset = queryset.filter(raised_by=user)

        dispute_status = self.request.query_params.get('status')
        dispute_type = self.request.query_params.get('type')
        bill_id = self.request.query_params.get('bill_id')
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        search = self.request.query_params.get('search', '')

        if dispute_status:
            queryset = queryset.filter(status=dispute_status)
        if dispute_type:
            queryset = queryset.filter(dispute_type=dispute_type)
        if bill_id:
            queryset = queryset.filter(bill_id=int(bill_id))
        if month:
            queryset = queryset.filter(bill__month=int(month))
        if year:
            queryset = queryset.filter(bill__year=int(year))
        if search and user.role != 'student':
            queryset = queryset.filter(
                Q(raised_by__username__icontains=search) |
                Q(raised_by__first_name__icontains=search) |
                Q(raised_by__last_name__icontains=search) |
                Q(raised_by__enrollment_number__icontains=search) |
                Q(description__icontains=search)
            )

        return queryset

    def perform_create(self, serializer):
        dispute = serializer.save(raised_by=self.request.user, status='open')
        bill = dispute.bill
        if bill.status != 'disputed':
            bill.status = 'disputed'
            bill.save(update_fields=['status'])

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        dispute = Dispute.objects.select_related(
            'bill', 'bill__student', 'raised_by', 'resolved_by'
        ).get(pk=serializer.instance.pk)
        return Response(
            DisputeSerializer(dispute).data,
            status=status.HTTP_201_CREATED,
        )


class DisputeDetailView(generics.RetrieveAPIView):
    """Retrieve a single dispute with full details."""

    serializer_class = DisputeSerializer
    queryset = Dispute.objects.select_related(
        'bill', 'bill__student', 'raised_by', 'resolved_by'
    )

    def get_object(self):
        obj = super().get_object()
        user = self.request.user
        # Students can only see their own disputes
        if user.role == 'student' and obj.raised_by != user:
            self.permission_denied(self.request)
        return obj


class CreateDisputeView(generics.CreateAPIView):
    """
    Create a new dispute. Only students can raise disputes on their own bills.
    Also marks the related bill status as 'disputed'.
    """

    serializer_class = CreateDisputeSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def perform_create(self, serializer):
        dispute = serializer.save(raised_by=self.request.user, status='open')
        # Mark the bill as disputed
        bill = dispute.bill
        if bill.status != 'disputed':
            bill.status = 'disputed'
            bill.save(update_fields=['status'])

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Return full dispute details
        dispute = Dispute.objects.select_related(
            'bill', 'bill__student', 'raised_by', 'resolved_by'
        ).get(pk=serializer.instance.pk)
        return Response(
            DisputeSerializer(dispute).data,
            status=status.HTTP_201_CREATED,
        )


class RespondToDisputeView(APIView):
    """
    Contractor responds to a dispute. Sets status to 'under_review'.
    POST body: { "contractor_response": "..." }
    """

    permission_classes = [permissions.IsAuthenticated, IsContractor]

    def post(self, request, pk):
        try:
            dispute = Dispute.objects.select_related(
                'bill', 'bill__student', 'raised_by', 'resolved_by'
            ).get(pk=pk)
        except Dispute.DoesNotExist:
            return Response(
                {'detail': 'Dispute not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if dispute.status in ('resolved', 'rejected'):
            return Response(
                {'detail': 'Cannot respond to an already resolved or rejected dispute.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ContractorResponseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        dispute.contractor_response = serializer.validated_data['contractor_response']
        dispute.status = 'under_review'
        dispute.save(update_fields=['contractor_response', 'status', 'updated_at'])

        return Response(DisputeSerializer(dispute).data)


class ResolveDisputeView(APIView):
    """
    Warden resolves or rejects a dispute.
    POST body: { "status": "resolved" or "rejected", "resolution_notes": "..." }
    If resolved, the bill status reverts to 'pending'.
    """

    permission_classes = [permissions.IsAuthenticated, IsWarden]

    def post(self, request, pk):
        try:
            dispute = Dispute.objects.select_related(
                'bill', 'bill__student', 'raised_by', 'resolved_by'
            ).get(pk=pk)
        except Dispute.DoesNotExist:
            return Response(
                {'detail': 'Dispute not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if dispute.status in ('resolved', 'rejected'):
            return Response(
                {'detail': 'Dispute has already been resolved or rejected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ResolveDisputeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data['status']
        resolution_notes = serializer.validated_data.get('resolution_notes', '')

        old_status = dispute.status
        dispute.status = new_status
        dispute.resolution_notes = resolution_notes
        dispute.resolved_by = request.user
        dispute.save(
            update_fields=['status', 'resolution_notes', 'resolved_by', 'updated_at']
        )

        # Log the resolution
        AuditLog.objects.create(
            user=request.user,
            user_role=request.user.role,
            action='resolve' if new_status == 'resolved' else 'reject',
            model_name='Dispute',
            object_id=dispute.id,
            old_values={'status': old_status},
            new_values={'status': new_status, 'resolution_notes': resolution_notes},
            description=f'{new_status.title()} dispute #{dispute.id} for bill #{dispute.bill_id}',
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        # If resolved, revert bill to pending so it can be corrected/re-generated
        if new_status == 'resolved':
            bill = dispute.bill
            bill.status = 'pending'
            bill.save(update_fields=['status'])

        return Response(DisputeSerializer(dispute).data)


class MyDisputesView(generics.ListAPIView):
    """List the authenticated student's own disputes."""

    serializer_class = DisputeSerializer
    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get_queryset(self):
        queryset = Dispute.objects.filter(
            raised_by=self.request.user
        ).select_related(
            'bill', 'bill__student', 'raised_by', 'resolved_by'
        )

        dispute_status = self.request.query_params.get('status')
        if dispute_status:
            queryset = queryset.filter(status=dispute_status)

        return queryset


class RejectDisputeView(APIView):
    """
    Warden rejects a dispute.
    POST body: { "resolution_notes": "..." }
    """

    permission_classes = [permissions.IsAuthenticated, IsWarden]

    def post(self, request, pk):
        try:
            dispute = Dispute.objects.select_related(
                'bill', 'bill__student', 'raised_by', 'resolved_by'
            ).get(pk=pk)
        except Dispute.DoesNotExist:
            return Response(
                {'detail': 'Dispute not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if dispute.status in ('resolved', 'rejected'):
            return Response(
                {'detail': 'Dispute has already been resolved or rejected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_status = dispute.status
        resolution_notes = request.data.get('resolution_notes', '')
        dispute.status = 'rejected'
        dispute.resolution_notes = resolution_notes
        dispute.resolved_by = request.user
        dispute.save(
            update_fields=['status', 'resolution_notes', 'resolved_by', 'updated_at']
        )

        # Log the rejection
        AuditLog.objects.create(
            user=request.user,
            user_role=request.user.role,
            action='reject',
            model_name='Dispute',
            object_id=dispute.id,
            old_values={'status': old_status},
            new_values={'status': 'rejected', 'resolution_notes': resolution_notes},
            description=f'Rejected dispute #{dispute.id} for bill #{dispute.bill_id}',
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        return Response(DisputeSerializer(dispute).data)


class DisputeSummaryView(APIView):
    """
    Get dispute summary statistics with SLA tracking.
    """

    permission_classes = [permissions.IsAuthenticated, IsContractorOrWarden]

    def get(self, request):
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        queryset = Dispute.objects.select_related('bill')

        if month:
            queryset = queryset.filter(bill__month=int(month))
        if year:
            queryset = queryset.filter(bill__year=int(year))

        # Counts by status
        total_disputes = queryset.count()
        open_count = queryset.filter(status='open').count()
        under_review_count = queryset.filter(status='under_review').count()
        resolved_count = queryset.filter(status='resolved').count()
        rejected_count = queryset.filter(status='rejected').count()

        # Unresolved (highlighting)
        unresolved = queryset.filter(status__in=['open', 'under_review'])
        unresolved_count = unresolved.count()

        # SLA tracking - average resolution time in days
        resolved_disputes = queryset.filter(status__in=['resolved', 'rejected'])
        avg_resolution_time = None
        if resolved_disputes.exists():
            # Calculate average days between created_at and updated_at
            resolution_times = []
            for d in resolved_disputes:
                delta = (d.updated_at - d.created_at).days
                resolution_times.append(delta)
            if resolution_times:
                avg_resolution_time = round(sum(resolution_times) / len(resolution_times), 1)

        # Disputes by type
        billing_disputes = queryset.filter(dispute_type='billing').count()
        attendance_disputes = queryset.filter(dispute_type='attendance').count()

        # Resolution rate
        closed_disputes = resolved_count + rejected_count
        resolution_rate = (
            round((closed_disputes / total_disputes) * 100, 1)
            if total_disputes > 0 else 0
        )

        return Response({
            'total': total_disputes,
            'counts': {
                'open': open_count,
                'under_review': under_review_count,
                'resolved': resolved_count,
                'rejected': rejected_count,
                'unresolved': unresolved_count,
            },
            'by_type': {
                'billing': billing_disputes,
                'attendance': attendance_disputes,
            },
            'sla': {
                'avg_resolution_days': avg_resolution_time,
            },
            'resolution_rate': resolution_rate,
        })


class ReopenDisputeView(APIView):
    """
    Reopen a resolved/rejected dispute within the allowed time window.
    Only the student who raised the dispute can reopen it.
    POST body: { "reason": "Reason for reopening" }
    """

    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def post(self, request, pk):
        from datetime import date
        from .serializers import REOPEN_WINDOW_DAYS

        try:
            dispute = Dispute.objects.select_related(
                'bill', 'bill__student', 'raised_by', 'resolved_by'
            ).get(pk=pk)
        except Dispute.DoesNotExist:
            return Response(
                {'detail': 'Dispute not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify ownership
        if dispute.raised_by != request.user:
            return Response(
                {'detail': 'You can only reopen your own disputes.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if dispute is in resolved/rejected status
        if dispute.status not in ('resolved', 'rejected'):
            return Response(
                {'detail': 'Only resolved or rejected disputes can be reopened.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check time window
        days_since_resolution = (date.today() - dispute.updated_at.date()).days
        if days_since_resolution > REOPEN_WINDOW_DAYS:
            return Response(
                {'detail': f'Reopen window expired. Disputes can only be reopened within {REOPEN_WINDOW_DAYS} days of resolution.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get('reason', '')
        old_status = dispute.status

        # Append reopen reason to description
        dispute.description = f"{dispute.description}\n\n[REOPENED: {reason}]"
        dispute.status = 'open'
        dispute.contractor_response = ''
        dispute.resolution_notes = ''
        dispute.resolved_by = None
        dispute.save()

        # Update bill status back to disputed
        bill = dispute.bill
        if bill.status != 'disputed':
            bill.status = 'disputed'
            bill.save(update_fields=['status'])

        # Log the reopen action
        AuditLog.objects.create(
            user=request.user,
            user_role=request.user.role,
            action='reopen',
            model_name='Dispute',
            object_id=dispute.id,
            old_values={'status': old_status},
            new_values={'status': 'open', 'reason': reason},
            description=f'Reopened dispute #{dispute.id} for bill #{dispute.bill_id}',
            ip_address=request.META.get('REMOTE_ADDR'),
        )

        return Response(DisputeSerializer(dispute).data)