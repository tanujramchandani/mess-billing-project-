from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    """Serializer for payment records with bill and student details."""

    student_name = serializers.CharField(
        source='student.get_full_name', read_only=True
    )
    student_username = serializers.CharField(
        source='student.username', read_only=True
    )
    student_enrollment = serializers.CharField(
        source='student.enrollment_number', read_only=True
    )
    bill_month = serializers.IntegerField(source='bill.month', read_only=True)
    bill_year = serializers.IntegerField(source='bill.year', read_only=True)
    bill_amount = serializers.DecimalField(
        source='bill.total_amount',
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    verified_by_name = serializers.CharField(
        source='verified_by.username', read_only=True, default=None
    )

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = [
            'student', 'payment_date', 'status',
            'verified_by', 'created_at',
        ]


class SubmitPaymentSerializer(serializers.ModelSerializer):
    """Serializer for students submitting a payment."""

    class Meta:
        model = Payment
        fields = [
            'bill', 'amount', 'payment_method',
            'transaction_id', 'receipt_image', 'notes',
        ]

    def validate_bill(self, value):
        request = self.context.get('request')
        if request and value.student != request.user:
            raise serializers.ValidationError(
                "You can only make payments for your own bills."
            )
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be greater than zero.")
        return value


class VerifyPaymentSerializer(serializers.Serializer):
    """Serializer for contractors/wardens to verify or reject a payment."""

    status = serializers.ChoiceField(choices=['verified', 'rejected'])
    notes = serializers.CharField(required=False, allow_blank=True)
