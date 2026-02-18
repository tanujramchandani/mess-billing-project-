from rest_framework import serializers
from django.db.models import Q
from .models import MessRate, Attendance


class MessRateSerializer(serializers.ModelSerializer):
    """Serializer for mess rate configuration with validation."""

    created_by_name = serializers.CharField(
        source='created_by.username', read_only=True
    )

    class Meta:
        model = MessRate
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']

    def validate(self, data):
        """
        Validate mess rate rules:
        1. Only one active rate at a time for a given month/year
        2. Prevent overlapping month rates
        3. Cannot edit rate for month if bills already generated
        """
        from billing.models import Bill, BillingCycle

        month = data.get('month')
        year = data.get('year')
        is_active = data.get('is_active', True)
        instance = self.instance

        # Check for existing rate for this month/year
        existing_rate = MessRate.objects.filter(month=month, year=year)
        if instance:
            existing_rate = existing_rate.exclude(pk=instance.pk)
        
        if existing_rate.exists():
            raise serializers.ValidationError({
                'month': f'A mess rate already exists for {month}/{year}. Edit the existing rate instead.'
            })

        # Check if editing existing rate with bills already generated
        if instance:
            bills_exist = Bill.objects.filter(month=month, year=year).exists()
            if bills_exist:
                # Only allow deactivating, not rate changes
                changing_rates = (
                    data.get('lunch_rate', instance.lunch_rate) != instance.lunch_rate or
                    data.get('dinner_rate', instance.dinner_rate) != instance.dinner_rate
                )
                if changing_rates:
                    raise serializers.ValidationError({
                        'detail': f'Cannot modify rates for {month}/{year} - bills have already been generated. Please create a new billing cycle.'
                    })

        # Check billing cycle status - if cycle is billed/closed, don't allow changes
        if instance:
            try:
                cycle = BillingCycle.objects.get(month=month, year=year)
                if cycle.status in ['billed', 'payment_ongoing', 'closed']:
                    raise serializers.ValidationError({
                        'detail': f'Cannot modify rate for {month}/{year} - billing cycle is in {cycle.status} status.'
                    })
            except BillingCycle.DoesNotExist:
                pass

        return data


class AttendanceSerializer(serializers.ModelSerializer):
    """Serializer for individual attendance records."""

    student_name = serializers.CharField(
        source='student.get_full_name', read_only=True
    )
    student_username = serializers.CharField(
        source='student.username', read_only=True
    )
    student_enrollment = serializers.CharField(
        source='student.enrollment_number', read_only=True
    )
    marked_by_name = serializers.CharField(
        source='marked_by.username', read_only=True
    )
    status = serializers.SerializerMethodField()

    class Meta:
        model = Attendance
        fields = '__all__'
        read_only_fields = ['marked_by', 'created_at', 'modified_at']

    def get_status(self, obj):
        if obj.lunch and obj.dinner:
            return 'both'
        elif obj.lunch:
            return 'lunch_only'
        elif obj.dinner:
            return 'dinner_only'
        return 'absent'


class BulkAttendanceSerializer(serializers.Serializer):
    """Serializer for marking attendance for multiple students at once."""

    date = serializers.DateField()
    students = serializers.ListField(child=serializers.DictField())

    def validate_students(self, value):
        for entry in value:
            if 'student_id' not in entry:
                raise serializers.ValidationError(
                    "Each entry must have a 'student_id' field."
                )
            if 'lunch' not in entry and 'dinner' not in entry:
                raise serializers.ValidationError(
                    "Each entry must have 'lunch' and/or 'dinner' fields."
                )
        return value


class AttendanceSummarySerializer(serializers.Serializer):
    """Serializer for attendance summary statistics."""

    student_id = serializers.IntegerField()
    student_name = serializers.CharField()
    student_enrollment = serializers.CharField()
    total_days = serializers.IntegerField()
    lunch_days = serializers.IntegerField()
    dinner_days = serializers.IntegerField()
    both_days = serializers.IntegerField()
    absent_days = serializers.IntegerField()
