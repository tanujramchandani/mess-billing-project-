from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Sum, Q, Avg
from django.db.models.functions import TruncMonth
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsContractorOrWarden, IsWardenOrAdmin, IsStudent
from attendance.models import Attendance, MessRate
from billing.models import Bill, BillingCycle
from disputes.models import Dispute
from payments.models import Payment


class DashboardStatsView(APIView):
    """
    Return role-specific dashboard statistics.
    - Students: attendance %, bills, pending amount, disputes, recent bills, trend
    - Contractors: student count, today's attendance, bills generated, disputes, attendance summary
    - Wardens: total users, disputes, revenue, pending payments, billing trends, dispute distribution, activity
    """

    def get(self, request):
        user = request.user

        if user.role == 'student':
            return self._student_dashboard(user)
        elif user.role == 'contractor':
            return self._contractor_dashboard(user)
        elif user.role == 'warden':
            return self._warden_dashboard(user)

        return self._student_dashboard(user)

    def _student_dashboard(self, user):
        today = date.today()
        month, year = today.month, today.year

        # Attendance stats for this month
        attendance_qs = Attendance.objects.filter(
            student=user, date__month=month, date__year=year
        )
        total_days = attendance_qs.count()
        lunch_days = attendance_qs.filter(lunch=True).count()
        dinner_days = attendance_qs.filter(dinner=True).count()
        meals_possible = total_days * 2  # lunch + dinner per day
        meals_taken = lunch_days + dinner_days
        attendance_percentage = (
            round((meals_taken / meals_possible) * 100) if meals_possible > 0 else 0
        )

        # Attendance eligibility warning (below 75%)
        attendance_warning = attendance_percentage < 75 if meals_possible > 0 else False

        # Bill stats
        all_bills = Bill.objects.filter(student=user)
        total_bills = all_bills.count()
        pending_bills = all_bills.filter(status__in=['pending', 'overdue'])
        pending_amount = pending_bills.aggregate(total=Sum('total_amount'))['total'] or 0

        # Overdue bills
        overdue_bills = all_bills.filter(
            Q(status='overdue') | Q(status='pending', due_date__lt=today)
        )
        overdue_count = overdue_bills.count()
        overdue_amount = overdue_bills.aggregate(total=Sum('total_amount'))['total'] or 0

        # Next bill due date
        next_due_bill = all_bills.filter(
            status__in=['pending', 'overdue'],
            due_date__isnull=False
        ).order_by('due_date').first()
        next_due_date = next_due_bill.due_date.isoformat() if next_due_bill else None
        days_until_due = (next_due_bill.due_date - today).days if next_due_bill and next_due_bill.due_date else None

        # Active disputes
        active_disputes = Dispute.objects.filter(
            raised_by=user, status__in=['open', 'under_review']
        ).count()

        # Lifetime paid amount
        lifetime_paid = Payment.objects.filter(
            bill__student=user, status='verified'
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Current year paid
        current_year_paid = Payment.objects.filter(
            bill__student=user, status='verified',
            payment_date__year=year
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Recent bills
        recent_bills = list(
            all_bills.order_by('-year', '-month')[:5]
            .values('id', 'month', 'year', 'total_amount', 'status', 'due_date')
        )

        # Monthly spending trend (last 6 months)
        spending_trend = []
        for i in range(5, -1, -1):
            m = month - i
            y = year
            while m <= 0:
                m += 12
                y -= 1
            bill = all_bills.filter(month=m, year=y).first()
            spending_trend.append({
                'month': date(y, m, 1).strftime('%b'),
                'year': y,
                'amount': float(bill.total_amount) if bill else 0,
            })

        # Attendance trend (last 30 days)
        thirty_days_ago = today - timedelta(days=30)
        attendance_trend = []
        records = Attendance.objects.filter(
            student=user, date__gte=thirty_days_ago
        ).order_by('date')

        for record in records:
            attendance_trend.append({
                'date': record.date.strftime('%b %d'),
                'lunch': 1 if record.lunch else 0,
                'dinner': 1 if record.dinner else 0,
            })

        # Check billing cycle status for current month
        billing_cycle_status = 'not_created'
        try:
            cycle = BillingCycle.objects.get(month=month, year=year)
            billing_cycle_status = cycle.status
        except BillingCycle.DoesNotExist:
            pass

        return Response({
            'stats': {
                'attendance_percentage': attendance_percentage,
                'lunch_days': lunch_days,
                'dinner_days': dinner_days,
                'total_bills': total_bills,
                'pending_amount': str(pending_amount),
                'active_disputes': active_disputes,
                'lifetime_paid': str(lifetime_paid),
                'current_year_paid': str(current_year_paid),
                'overdue_count': overdue_count,
                'overdue_amount': str(overdue_amount),
                'next_due_date': next_due_date,
                'days_until_due': days_until_due,
                'attendance_warning': attendance_warning,
            },
            'alerts': {
                'overdue_warning': overdue_count > 0,
                'attendance_below_threshold': attendance_warning,
            },
            'recent_bills': recent_bills,
            'attendance_trend': attendance_trend,
            'spending_trend': spending_trend,
            'billing_cycle_status': billing_cycle_status,
        })

    def _contractor_dashboard(self, user):
        today = date.today()
        current_month = today.month
        current_year = today.year

        total_students = User.objects.filter(role='student').count()

        # Today's attendance (students who had at least lunch or dinner)
        today_lunch = Attendance.objects.filter(date=today, lunch=True).count()
        today_dinner = Attendance.objects.filter(date=today, dinner=True).count()

        # Today's revenue (verified payments made today)
        today_revenue = (
            Payment.objects.filter(
                status='verified',
                payment_date=today
            ).aggregate(total=Sum('amount'))['total'] or 0
        )

        # This month's revenue (verified payments this month)
        month_revenue = (
            Payment.objects.filter(
                status='verified',
                payment_date__month=current_month,
                payment_date__year=current_year
            ).aggregate(total=Sum('amount'))['total'] or 0
        )

        # Bills generated this month
        bills_this_month = Bill.objects.filter(
            month=current_month,
            year=current_year
        ).count()

        # Unpaid bills count (pending + overdue)
        unpaid_bills = Bill.objects.filter(
            status__in=['pending', 'overdue']
        ).count()

        # Weekly attendance percentage
        week_start = today - timedelta(days=6)
        weekly_attendance = Attendance.objects.filter(
            date__gte=week_start,
            date__lte=today
        )
        weekly_meals_possible = total_students * 7 * 2  # students * days * meals
        weekly_meals_taken = (
            weekly_attendance.filter(lunch=True).count() +
            weekly_attendance.filter(dinner=True).count()
        )
        weekly_attendance_pct = (
            round((weekly_meals_taken / weekly_meals_possible) * 100, 1)
            if weekly_meals_possible > 0 else 0
        )

        # Pending disputes
        pending_disputes = Dispute.objects.filter(
            status__in=['open', 'under_review']
        ).count()

        # Attendance summary for last 7 days
        attendance_summary = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            lunch = Attendance.objects.filter(date=day, lunch=True).count()
            dinner = Attendance.objects.filter(date=day, dinner=True).count()
            attendance_summary.append({
                'date': day.strftime('%b %d'),
                'lunch': lunch,
                'dinner': dinner,
            })

        # Recent bills (last 5)
        recent_bills = list(
            Bill.objects.select_related('student')
            .order_by('-generated_at')[:5]
            .values(
                'id', 'month', 'year', 'total_amount', 'status',
                'student__username', 'student__first_name', 'student__last_name'
            )
        )

        # Billing cycle status for current month
        from billing.models import BillingCycle
        try:
            current_cycle = BillingCycle.objects.get(
                month=current_month, year=current_year
            )
            billing_cycle_status = current_cycle.status
        except BillingCycle.DoesNotExist:
            billing_cycle_status = 'not_created'

        return Response({
            'stats': {
                'total_students': total_students,
                'today_lunch': today_lunch,
                'today_dinner': today_dinner,
                'today_revenue': str(today_revenue),
                'month_revenue': str(month_revenue),
                'bills_this_month': bills_this_month,
                'unpaid_bills': unpaid_bills,
                'weekly_attendance_pct': weekly_attendance_pct,
                'pending_disputes': pending_disputes,
                'billing_cycle_status': billing_cycle_status,
            },
            'attendance_summary': attendance_summary,
            'recent_bills': recent_bills,
        })

    def _warden_dashboard(self, user):
        today = date.today()

        total_users = User.objects.count()
        active_disputes = Dispute.objects.filter(
            status__in=['open', 'under_review']
        ).count()

        # Total revenue from verified payments
        total_revenue = (
            Payment.objects.filter(status='verified')
            .aggregate(total=Sum('amount'))['total']
            or 0
        )

        # Pending payments amount
        pending_payments = (
            Payment.objects.filter(status='pending')
            .aggregate(total=Sum('amount'))['total']
            or 0
        )

        # Billing trends - monthly aggregation for last 6 months
        billing_trend = []
        for i in range(5, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1

            month_bills = Bill.objects.filter(month=m, year=y)
            total_amount = (
                month_bills.aggregate(total=Sum('total_amount'))['total'] or 0
            )
            collected = (
                Payment.objects.filter(
                    bill__month=m, bill__year=y, status='verified'
                ).aggregate(total=Sum('amount'))['total']
                or 0
            )
            billing_trend.append({
                'month': date(y, m, 1).strftime('%b %Y'),
                'amount': float(total_amount),
                'collected': float(collected),
            })

        # Dispute distribution by status
        dispute_counts = (
            Dispute.objects.values('status')
            .annotate(count=Count('id'))
            .order_by('status')
        )
        status_labels = {
            'open': 'Open',
            'under_review': 'Under Review',
            'resolved': 'Resolved',
            'rejected': 'Rejected',
        }
        dispute_distribution = [
            {'name': status_labels.get(d['status'], d['status']), 'value': d['count']}
            for d in dispute_counts
        ]

        # Recent activity - combine recent disputes, payments, and bills
        recent_activity = []

        recent_disputes = Dispute.objects.select_related(
            'raised_by', 'bill'
        ).order_by('-created_at')[:5]
        for d in recent_disputes:
            recent_activity.append({
                'description': f'Dispute raised on bill {d.bill.month}/{d.bill.year}',
                'user': d.raised_by.username,
                'timestamp': d.created_at.isoformat(),
                'type': d.status,
            })

        recent_payments = Payment.objects.select_related(
            'student', 'bill'
        ).order_by('-created_at')[:5]
        for p in recent_payments:
            recent_activity.append({
                'description': f'Payment of Rs.{p.amount} for bill {p.bill.month}/{p.bill.year}',
                'user': p.student.username,
                'timestamp': p.created_at.isoformat(),
                'type': p.status,
            })

        # Sort by timestamp descending
        recent_activity.sort(key=lambda x: x['timestamp'], reverse=True)
        recent_activity = recent_activity[:10]

        return Response({
            'stats': {
                'total_users': total_users,
                'active_disputes': active_disputes,
                'total_revenue': str(total_revenue),
                'pending_payments': str(pending_payments),
            },
            'billing_trend': billing_trend,
            'dispute_distribution': dispute_distribution,
            'recent_activity': recent_activity,
        })


class AttendanceTrendsView(APIView):
    """Return attendance trend data for charts."""

    def get(self, request):
        days = int(request.query_params.get('days', 30))
        today = date.today()
        start_date = today - timedelta(days=days)

        trends = []
        for i in range(days + 1):
            day = start_date + timedelta(days=i)
            lunch = Attendance.objects.filter(date=day, lunch=True).count()
            dinner = Attendance.objects.filter(date=day, dinner=True).count()
            trends.append({
                'date': day.strftime('%b %d'),
                'lunch': lunch,
                'dinner': dinner,
                'total': lunch + dinner,
            })

        return Response(trends)


class BillingSummaryView(APIView):
    """Return billing summary data."""

    def get(self, request):
        year = int(request.query_params.get('year', date.today().year))

        summary = []
        for month in range(1, 13):
            bills = Bill.objects.filter(month=month, year=year)
            total = bills.aggregate(total=Sum('total_amount'))['total'] or 0
            paid = bills.filter(status='paid').aggregate(total=Sum('total_amount'))['total'] or 0
            pending = bills.filter(status='pending').aggregate(total=Sum('total_amount'))['total'] or 0
            count = bills.count()

            summary.append({
                'month': date(year, month, 1).strftime('%b'),
                'total': float(total),
                'paid': float(paid),
                'pending': float(pending),
                'count': count,
            })

        return Response(summary)


class DisputeStatsView(APIView):
    """Return dispute statistics."""

    def get(self, request):
        total = Dispute.objects.count()
        by_status = dict(
            Dispute.objects.values_list('status')
            .annotate(count=Count('id'))
            .values_list('status', 'count')
        )
        by_type = dict(
            Dispute.objects.values_list('dispute_type')
            .annotate(count=Count('id'))
            .values_list('dispute_type', 'count')
        )

        return Response({
            'total': total,
            'by_status': {
                'open': by_status.get('open', 0),
                'under_review': by_status.get('under_review', 0),
                'resolved': by_status.get('resolved', 0),
                'rejected': by_status.get('rejected', 0),
            },
            'by_type': {
                'billing': by_type.get('billing', 0),
                'attendance': by_type.get('attendance', 0),
            },
        })


class PaymentStatsView(APIView):
    """Return payment statistics."""

    def get(self, request):
        total_payments = Payment.objects.count()
        total_amount = Payment.objects.aggregate(total=Sum('amount'))['total'] or 0
        verified_amount = (
            Payment.objects.filter(status='verified')
            .aggregate(total=Sum('amount'))['total']
            or 0
        )
        pending_amount = (
            Payment.objects.filter(status='pending')
            .aggregate(total=Sum('amount'))['total']
            or 0
        )
        rejected_amount = (
            Payment.objects.filter(status='rejected')
            .aggregate(total=Sum('amount'))['total']
            or 0
        )

        by_method = dict(
            Payment.objects.values_list('payment_method')
            .annotate(count=Count('id'))
            .values_list('payment_method', 'count')
        )

        return Response({
            'total_payments': total_payments,
            'total_amount': str(total_amount),
            'verified_amount': str(verified_amount),
            'pending_amount': str(pending_amount),
            'rejected_amount': str(rejected_amount),
            'by_method': {
                'cash': by_method.get('cash', 0),
                'online': by_method.get('online', 0),
                'cheque': by_method.get('cheque', 0),
            },
        })


class HostelRevenueView(APIView):
    """Return revenue breakdown by hostel."""

    permission_classes = [permissions.IsAuthenticated, IsWardenOrAdmin]

    def get(self, request):
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        queryset = Bill.objects.select_related('student')

        if month:
            queryset = queryset.filter(month=int(month))
        if year:
            queryset = queryset.filter(year=int(year))

        # Group by hostel
        hostel_revenue = {}
        for bill in queryset:
            hostel = bill.student.hostel or 'Unknown'
            if hostel not in hostel_revenue:
                hostel_revenue[hostel] = {
                    'total_amount': 0,
                    'paid_amount': 0,
                    'pending_amount': 0,
                    'student_count': set(),
                }
            hostel_revenue[hostel]['student_count'].add(bill.student.id)
            hostel_revenue[hostel]['total_amount'] += float(bill.total_amount)
            if bill.status == 'paid':
                hostel_revenue[hostel]['paid_amount'] += float(bill.total_amount)
            elif bill.status in ['pending', 'overdue']:
                hostel_revenue[hostel]['pending_amount'] += float(bill.total_amount)

        result = []
        for hostel, data in hostel_revenue.items():
            result.append({
                'hostel': hostel,
                'total_amount': data['total_amount'],
                'paid_amount': data['paid_amount'],
                'pending_amount': data['pending_amount'],
                'student_count': len(data['student_count']),
            })

        # Sort by total amount descending
        result.sort(key=lambda x: x['total_amount'], reverse=True)

        return Response(result)


class MonthlySummaryView(APIView):
    """Return comprehensive monthly summary for dashboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        month = int(request.query_params.get('month', today.month))
        year = int(request.query_params.get('year', today.year))

        # Students summary
        total_students = User.objects.filter(role='student').count()

        # Attendance summary
        attendance_records = Attendance.objects.filter(
            date__month=month, date__year=year
        )
        total_attendance = attendance_records.count()
        lunch_count = attendance_records.filter(lunch=True).count()
        dinner_count = attendance_records.filter(dinner=True).count()

        # Bills summary
        bills = Bill.objects.filter(month=month, year=year)
        total_bills = bills.count()
        total_billed = bills.aggregate(total=Sum('total_amount'))['total'] or 0
        paid_bills = bills.filter(status='paid')
        total_paid = paid_bills.aggregate(total=Sum('total_amount'))['total'] or 0
        pending_bills = bills.filter(status__in=['pending', 'overdue'])
        total_pending = pending_bills.aggregate(total=Sum('total_amount'))['total'] or 0

        # Disputes summary
        disputes = Dispute.objects.filter(
            bill__month=month, bill__year=year
        )
        total_disputes = disputes.count()
        open_disputes = disputes.filter(status__in=['open', 'under_review']).count()
        resolved_disputes = disputes.filter(status='resolved').count()

        # Payments summary for this month
        payments = Payment.objects.filter(
            bill__month=month, bill__year=year
        )
        verified_payments = payments.filter(status='verified').aggregate(
            total=Sum('amount')
        )['total'] or 0

        return Response({
            'month': month,
            'year': year,
            'students': {
                'total': total_students,
            },
            'attendance': {
                'total_records': total_attendance,
                'lunch_count': lunch_count,
                'dinner_count': dinner_count,
                'avg_lunch_per_student': round(lunch_count / total_students, 1) if total_students > 0 else 0,
                'avg_dinner_per_student': round(dinner_count / total_students, 1) if total_students > 0 else 0,
            },
            'billing': {
                'total_bills': total_bills,
                'total_billed': float(total_billed),
                'total_paid': float(total_paid),
                'total_pending': float(total_pending),
                'collection_rate': round((float(verified_payments) / float(total_billed)) * 100, 1) if total_billed > 0 else 0,
            },
            'disputes': {
                'total': total_disputes,
                'open': open_disputes,
                'resolved': resolved_disputes,
                'resolution_rate': round((resolved_disputes / total_disputes) * 100, 1) if total_disputes > 0 else 0,
            },
        })


class StudentFinancialSummaryView(APIView):
    """
    Comprehensive financial summary for students.
    Includes lifetime stats, attendance vs bill correlation.
    """

    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request):
        user = request.user
        today = date.today()
        current_year = today.year
        current_month = today.month

        # All bills for this student
        all_bills = Bill.objects.filter(student=user)

        # Lifetime statistics
        lifetime_bills = all_bills.aggregate(
            total_count=Count('id'),
            total_amount=Sum('total_amount')
        )
        lifetime_bills_count = lifetime_bills['total_count'] or 0
        lifetime_bills_amount = lifetime_bills['total_amount'] or 0

        # Lifetime paid
        lifetime_paid = Payment.objects.filter(
            bill__student=user, status='verified'
        ).aggregate(total=Sum('amount'))['total'] or 0

        # Total pending
        total_pending = all_bills.filter(
            status__in=['pending', 'overdue']
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        # Average monthly bill
        avg_monthly_bill = (
            float(lifetime_bills_amount) / lifetime_bills_count
            if lifetime_bills_count > 0 else 0
        )

        # Current year stats
        current_year_bills = all_bills.filter(year=current_year)
        current_year_paid = Payment.objects.filter(
            bill__student=user, status='verified',
            payment_date__year=current_year
        ).aggregate(total=Sum('amount'))['total'] or 0
        current_year_billed = current_year_bills.aggregate(
            total=Sum('total_amount')
        )['total'] or 0

        # Attendance vs Bill correlation (last 6 months)
        correlation_data = []
        for i in range(5, -1, -1):
            m = current_month - i
            y = current_year
            while m <= 0:
                m += 12
                y -= 1

            # Get attendance data for this month
            attendance_qs = Attendance.objects.filter(
                student=user, date__month=m, date__year=y
            )
            total_days = attendance_qs.count()
            meals_taken = (
                attendance_qs.filter(lunch=True).count() +
                attendance_qs.filter(dinner=True).count()
            )
            meals_possible = total_days * 2
            attendance_pct = (
                round((meals_taken / meals_possible) * 100)
                if meals_possible > 0 else 0
            )

            # Get bill amount for this month
            bill = all_bills.filter(month=m, year=y).first()
            bill_amount = float(bill.total_amount) if bill else 0

            correlation_data.append({
                'month': date(y, m, 1).strftime('%b %Y'),
                'attendance_pct': attendance_pct,
                'bill_amount': bill_amount,
            })

        # Overdue amount
        overdue_amount = all_bills.filter(
            Q(status='overdue') | Q(status='pending', due_date__lt=today)
        ).aggregate(total=Sum('total_amount'))['total'] or 0

        # Payment history summary
        payment_methods = Payment.objects.filter(
            bill__student=user, status='verified'
        ).values('payment_method').annotate(
            count=Count('id'),
            total=Sum('amount')
        )

        return Response({
            'lifetime': {
                'bills_generated': lifetime_bills_count,
                'total_billed': float(lifetime_bills_amount),
                'total_paid': float(lifetime_paid),
                'total_pending': float(total_pending),
                'overdue_amount': float(overdue_amount),
                'avg_monthly_bill': round(avg_monthly_bill, 2),
            },
            'current_year': {
                'year': current_year,
                'total_billed': float(current_year_billed),
                'total_paid': float(current_year_paid),
                'bills_count': current_year_bills.count(),
            },
            'correlation_data': correlation_data,
            'payment_methods': list(payment_methods),
        })


class StudentAttendanceSummaryView(APIView):
    """
    Monthly attendance summary for students with aggregated stats.
    """

    permission_classes = [permissions.IsAuthenticated, IsStudent]

    def get(self, request):
        user = request.user
        month = request.query_params.get('month')
        year = request.query_params.get('year')

        today = date.today()
        if not month:
            month = today.month
        if not year:
            year = today.year

        month = int(month)
        year = int(year)

        # Get all attendance records for the month
        attendance_qs = Attendance.objects.filter(
            student=user, date__month=month, date__year=year
        ).order_by('date')

        total_records = attendance_qs.count()
        lunch_days = attendance_qs.filter(lunch=True).count()
        dinner_days = attendance_qs.filter(dinner=True).count()
        both_days = attendance_qs.filter(lunch=True, dinner=True).count()
        lunch_only = attendance_qs.filter(lunch=True, dinner=False).count()
        dinner_only = attendance_qs.filter(lunch=False, dinner=True).count()
        absent_days = attendance_qs.filter(lunch=False, dinner=False).count()

        meals_possible = total_records * 2
        meals_taken = lunch_days + dinner_days
        attendance_percentage = (
            round((meals_taken / meals_possible) * 100, 1)
            if meals_possible > 0 else 0
        )
        lunch_percentage = (
            round((lunch_days / total_records) * 100, 1)
            if total_records > 0 else 0
        )
        dinner_percentage = (
            round((dinner_days / total_records) * 100, 1)
            if total_records > 0 else 0
        )

        # Detailed attendance records
        records = list(attendance_qs.values(
            'id', 'date', 'lunch', 'dinner', 'created_at', 'modified_at'
        ))

        return Response({
            'month': month,
            'year': year,
            'summary': {
                'total_days': total_records,
                'lunch_days': lunch_days,
                'dinner_days': dinner_days,
                'both_meals_days': both_days,
                'lunch_only_days': lunch_only,
                'dinner_only_days': dinner_only,
                'absent_days': absent_days,
                'meals_possible': meals_possible,
                'meals_taken': meals_taken,
                'attendance_percentage': attendance_percentage,
                'lunch_percentage': lunch_percentage,
                'dinner_percentage': dinner_percentage,
            },
            'records': records,
        })
