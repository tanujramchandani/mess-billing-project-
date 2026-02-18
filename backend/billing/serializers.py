from datetime import date
from rest_framework import serializers
from django.db.models import Sum
from .models import Bill, BillingCycle


class BillingCycleSerializer(serializers.ModelSerializer):
    """Serializer for billing cycle management."""

    created_by_name = serializers.CharField(
        source='created_by.username', read_only=True
    )
    is_attendance_editable = serializers.BooleanField(read_only=True)
    can_generate_bills = serializers.BooleanField(read_only=True)
    can_accept_payments = serializers.BooleanField(read_only=True)
    is_locked = serializers.BooleanField(read_only=True)
    total_bills = serializers.SerializerMethodField()
    total_revenue = serializers.SerializerMethodField()

    class Meta:
        model = BillingCycle
        fields = '__all__'
        read_only_fields = ['created_by', 'generated_at', 'closed_at']

    def get_total_bills(self, obj):
        return Bill.objects.filter(month=obj.month, year=obj.year).count()

    def get_total_revenue(self, obj):
        from django.db.models import Sum
        total = Bill.objects.filter(
            month=obj.month, year=obj.year
        ).aggregate(total=Sum('total_amount'))['total']
        return str(total) if total else '0'


class BillSerializer(serializers.ModelSerializer):
    """Serializer for bill records with student detail annotations."""

    student_name = serializers.SerializerMethodField()
    student_username = serializers.CharField(
        source='student.username', read_only=True
    )
    student_enrollment = serializers.CharField(
        source='student.enrollment_number', read_only=True
    )
    student_hostel = serializers.CharField(
        source='student.hostel', read_only=True
    )
    student_room = serializers.CharField(
        source='student.room_number', read_only=True
    )
    generated_by_name = serializers.CharField(
        source='generated_by.username', read_only=True
    )
    days_present = serializers.SerializerMethodField()
    rate_per_day = serializers.SerializerMethodField()
    # Financial tracking fields
    paid_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    payment_progress = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    days_overdue = serializers.SerializerMethodField()

    class Meta:
        model = Bill
        fields = '__all__'
        read_only_fields = [
            'generated_by', 'generated_at', 'lunch_days',
            'dinner_days', 'lunch_rate', 'dinner_rate', 'total_amount',
        ]

    def get_student_name(self, obj):
        """Get student's display name with fallbacks."""
        if obj.student:
            full_name = obj.student.get_full_name()
            if full_name and full_name.strip():
                return full_name
            return obj.student.username
        return 'Unknown'

    def get_days_present(self, obj):
        """Calculate total days with at least one meal."""
        return max(obj.lunch_days, obj.dinner_days)

    def get_rate_per_day(self, obj):
        """Combined daily rate."""
        return str(obj.lunch_rate + obj.dinner_rate)

    def get_paid_amount(self, obj):
        """Amount paid via verified payments."""
        from payments.models import Payment
        total = Payment.objects.filter(
            bill=obj, status='verified'
        ).aggregate(total=Sum('amount'))['total'] or 0
        return str(total)

    def get_remaining_amount(self, obj):
        """Remaining amount to be paid."""
        from payments.models import Payment
        paid = Payment.objects.filter(
            bill=obj, status='verified'
        ).aggregate(total=Sum('amount'))['total'] or 0
        remaining = float(obj.total_amount) - float(paid)
        return str(max(0, remaining))

    def get_payment_progress(self, obj):
        """Payment progress percentage (0-100)."""
        from payments.models import Payment
        paid = Payment.objects.filter(
            bill=obj, status='verified'
        ).aggregate(total=Sum('amount'))['total'] or 0
        if obj.total_amount > 0:
            progress = (float(paid) / float(obj.total_amount)) * 100
            return round(min(100, progress), 1)
        return 0

    def get_is_overdue(self, obj):
        """Check if bill is overdue."""
        if obj.status == 'overdue':
            return True
        if obj.status in ['pending'] and obj.due_date:
            return obj.due_date < date.today()
        return False

    def get_days_overdue(self, obj):
        """Days since due date if overdue."""
        if obj.due_date and obj.status in ['pending', 'overdue']:
            delta = (date.today() - obj.due_date).days
            return max(0, delta)
        return 0


class BillDetailSerializer(BillSerializer):
    """Extended bill serializer with payment history for detail view."""

    payment_history = serializers.SerializerMethodField()
    dispute_info = serializers.SerializerMethodField()
    can_raise_dispute = serializers.SerializerMethodField()
    can_make_payment = serializers.SerializerMethodField()

    def get_payment_history(self, obj):
        """Get all payments for this bill."""
        from payments.models import Payment
        payments = Payment.objects.filter(bill=obj).order_by('-payment_date')
        return [
            {
                'id': p.id,
                'amount': str(p.amount),
                'payment_method': p.payment_method,
                'payment_date': p.payment_date.isoformat() if p.payment_date else None,
                'status': p.status,
                'verified_by_name': p.verified_by.username if p.verified_by else None,
                'verified_at': p.verified_at.isoformat() if p.verified_at else None,
                'notes': p.notes,
            }
            for p in payments
        ]

    def get_dispute_info(self, obj):
        """Get dispute information for this bill."""
        from disputes.models import Dispute
        disputes = Dispute.objects.filter(bill=obj).order_by('-created_at')
        if disputes.exists():
            latest = disputes.first()
            return {
                'has_dispute': True,
                'total_disputes': disputes.count(),
                'active_dispute': disputes.filter(
                    status__in=['open', 'under_review']
                ).exists(),
                'latest': {
                    'id': latest.id,
                    'status': latest.status,
                    'dispute_type': latest.dispute_type,
                    'created_at': latest.created_at.isoformat(),
                }
            }
        return {
            'has_dispute': False,
            'total_disputes': 0,
            'active_dispute': False,
            'latest': None,
        }

    def get_can_raise_dispute(self, obj):
        """Check if student can raise a new dispute."""
        from disputes.models import Dispute
        # Cannot dispute if already has active dispute
        if Dispute.objects.filter(
            bill=obj, status__in=['open', 'under_review']
        ).exists():
            return {'allowed': False, 'reason': 'Active dispute exists for this bill'}

        # Cannot dispute if older than 30 days from generation
        days_since_generation = (date.today() - obj.generated_at.date()).days
        if days_since_generation > 30:
            return {'allowed': False, 'reason': 'Dispute window expired (30 days)'}

        # Cannot dispute paid bills
        if obj.status == 'paid':
            return {'allowed': False, 'reason': 'Bill is already fully paid'}

        return {'allowed': True, 'reason': None}

    def get_can_make_payment(self, obj):
        """Check if student can make a payment."""
        # Check billing cycle status
        try:
            cycle = BillingCycle.objects.get(month=obj.month, year=obj.year)
            if cycle.status == 'closed':
                return {'allowed': False, 'reason': 'Billing cycle is closed'}
        except BillingCycle.DoesNotExist:
            pass

        # Cannot pay if fully paid
        if obj.status == 'paid':
            return {'allowed': False, 'reason': 'Bill is already fully paid'}

        # Check remaining amount
        from payments.models import Payment
        paid = Payment.objects.filter(
            bill=obj, status='verified'
        ).aggregate(total=Sum('amount'))['total'] or 0
        remaining = float(obj.total_amount) - float(paid)
        if remaining <= 0:
            return {'allowed': False, 'reason': 'No remaining amount to pay'}

        return {'allowed': True, 'reason': None}


class GenerateBillsSerializer(serializers.Serializer):
    """Serializer for the bill generation request."""

    month = serializers.IntegerField(min_value=1, max_value=12)
    year = serializers.IntegerField(min_value=2000, max_value=2100)
    due_date = serializers.DateField(required=False)
