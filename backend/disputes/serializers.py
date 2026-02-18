from datetime import date
from rest_framework import serializers
from .models import Dispute


# Dispute window in days (30 days from bill generation)
DISPUTE_WINDOW_DAYS = 30
REOPEN_WINDOW_DAYS = 7


class DisputeSerializer(serializers.ModelSerializer):
    """Serializer for dispute records with bill and user details."""

    raised_by_name = serializers.CharField(
        source='raised_by.get_full_name', read_only=True
    )
    raised_by_username = serializers.CharField(
        source='raised_by.username', read_only=True
    )
    resolved_by_name = serializers.CharField(
        source='resolved_by.username', read_only=True, default=None
    )
    bill_month = serializers.IntegerField(source='bill.month', read_only=True)
    bill_year = serializers.IntegerField(source='bill.year', read_only=True)
    bill_amount = serializers.DecimalField(
        source='bill.total_amount',
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    bill_student_name = serializers.CharField(
        source='bill.student.get_full_name', read_only=True
    )
    # Timeline and resolution tracking
    days_to_resolve = serializers.SerializerMethodField()
    timeline = serializers.SerializerMethodField()
    can_reopen = serializers.SerializerMethodField()

    class Meta:
        model = Dispute
        fields = '__all__'
        read_only_fields = [
            'raised_by', 'status', 'contractor_response',
            'resolved_by', 'resolution_notes', 'created_at', 'updated_at',
        ]

    def get_days_to_resolve(self, obj):
        """Calculate days taken to resolve the dispute."""
        if obj.status in ['resolved', 'rejected']:
            delta = (obj.updated_at.date() - obj.created_at.date()).days
            return delta
        return None

    def get_timeline(self, obj):
        """Build a timeline of dispute events."""
        timeline = [
            {
                'event': 'Dispute Raised',
                'date': obj.created_at.isoformat(),
                'description': obj.description[:100] if obj.description else '',
            }
        ]

        if obj.contractor_response:
            timeline.append({
                'event': 'Contractor Response',
                'date': obj.updated_at.isoformat(),
                'description': obj.contractor_response[:100] if obj.contractor_response else '',
            })

        if obj.status in ['resolved', 'rejected']:
            timeline.append({
                'event': f'Dispute {obj.status.title()}',
                'date': obj.updated_at.isoformat(),
                'description': obj.resolution_notes[:100] if obj.resolution_notes else '',
                'resolved_by': obj.resolved_by.username if obj.resolved_by else None,
            })

        return timeline

    def get_can_reopen(self, obj):
        """Check if dispute can be reopened within the allowed window."""
        if obj.status not in ['resolved', 'rejected']:
            return {'allowed': False, 'reason': 'Dispute is still active'}

        days_since_resolution = (date.today() - obj.updated_at.date()).days
        if days_since_resolution > REOPEN_WINDOW_DAYS:
            return {
                'allowed': False,
                'reason': f'Reopen window expired ({REOPEN_WINDOW_DAYS} days)'
            }

        return {'allowed': True, 'reason': None}


class CreateDisputeSerializer(serializers.ModelSerializer):
    """Serializer for students to create a new dispute."""

    class Meta:
        model = Dispute
        fields = ['bill', 'dispute_type', 'description']

    def validate_bill(self, value):
        request = self.context.get('request')
        if request and value.student != request.user:
            raise serializers.ValidationError(
                "You can only raise disputes for your own bills."
            )
        return value

    def validate(self, data):
        bill = data.get('bill')
        request = self.context.get('request')

        # Prevent duplicate active disputes for same bill
        if Dispute.objects.filter(
            bill=bill, status__in=['open', 'under_review']
        ).exists():
            raise serializers.ValidationError({
                'bill': 'An active dispute already exists for this bill.'
            })

        # Prevent disputes on fully paid bills
        if bill.status == 'paid':
            raise serializers.ValidationError({
                'bill': 'Cannot raise a dispute on a fully paid bill.'
            })

        # Enforce time restriction (30 days from bill generation)
        days_since_generation = (date.today() - bill.generated_at.date()).days
        if days_since_generation > DISPUTE_WINDOW_DAYS:
            raise serializers.ValidationError({
                'bill': f'Dispute window expired. Bills can only be disputed within {DISPUTE_WINDOW_DAYS} days of generation.'
            })

        return data


class ContractorResponseSerializer(serializers.Serializer):
    """Serializer for contractor's response to a dispute."""

    contractor_response = serializers.CharField()


class ResolveDisputeSerializer(serializers.Serializer):
    """Serializer for warden to resolve or reject a dispute."""

    status = serializers.ChoiceField(choices=['resolved', 'rejected'])
    resolution_notes = serializers.CharField(required=False, allow_blank=True)
