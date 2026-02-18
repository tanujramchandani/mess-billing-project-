"""
Management command to create sample data with 5 students, 5 months of realistic bills.
Each student has different attendance patterns - regular, irregular, etc.
"""
import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand
from django.db import transaction

from attendance.models import Attendance, MessRate
from billing.models import Bill, BillingCycle
from disputes.models import Dispute
from payments.models import Payment
from audit_logs.models import AuditLog

User = get_user_model()


# 5 Students with distinct profiles and attendance patterns
STUDENTS = [
    {
        'username': 'rahul_sharma',
        'first_name': 'Rahul',
        'last_name': 'Sharma',
        'enrollment': 'UE238101',
        'hostel': 'Hostel A',
        'room': '101',
        'phone': '+91 9876543001',
        'pattern': 'regular',  # 85-95% attendance
    },
    {
        'username': 'priya_patel',
        'first_name': 'Priya',
        'last_name': 'Patel',
        'enrollment': 'UE238102',
        'hostel': 'Hostel B',
        'room': '205',
        'phone': '+91 9876543002',
        'pattern': 'good',  # 70-85% attendance
    },
    {
        'username': 'amit_kumar',
        'first_name': 'Amit',
        'last_name': 'Kumar',
        'enrollment': 'UE238103',
        'hostel': 'Hostel A',
        'room': '312',
        'phone': '+91 9876543003',
        'pattern': 'average',  # 50-70% attendance
    },
    {
        'username': 'sneha_reddy',
        'first_name': 'Sneha',
        'last_name': 'Reddy',
        'enrollment': 'UE238104',
        'hostel': 'Hostel C',
        'room': '118',
        'phone': '+91 9876543004',
        'pattern': 'irregular',  # 30-50% attendance, skips lunch often
    },
    {
        'username': 'vikram_singh',
        'first_name': 'Vikram',
        'last_name': 'Singh',
        'enrollment': 'UE238105',
        'hostel': 'Hostel B',
        'room': '402',
        'phone': '+91 9876543005',
        'pattern': 'dinner_only',  # Mostly dinner, rarely lunch
    },
]

# Attendance patterns for realistic variation
ATTENDANCE_PATTERNS = {
    'regular': {
        'lunch_prob': 0.90,
        'dinner_prob': 0.92,
        'weekend_skip_prob': 0.15,
    },
    'good': {
        'lunch_prob': 0.78,
        'dinner_prob': 0.82,
        'weekend_skip_prob': 0.30,
    },
    'average': {
        'lunch_prob': 0.55,
        'dinner_prob': 0.65,
        'weekend_skip_prob': 0.50,
    },
    'irregular': {
        'lunch_prob': 0.30,
        'dinner_prob': 0.45,
        'weekend_skip_prob': 0.70,
    },
    'dinner_only': {
        'lunch_prob': 0.15,
        'dinner_prob': 0.88,
        'weekend_skip_prob': 0.40,
    },
}


class Command(BaseCommand):
    help = 'Create sample data: 5 students with 5 months of realistic attendance and bills'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear all existing data before creating sample data',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['clear']:
            self.clear_all_data()

        self.stdout.write(self.style.WARNING('\n=== Creating Sample Data ===\n'))

        # Ensure groups exist
        self.ensure_groups()

        # Create contractor and warden
        contractor = self.create_contractor()
        warden = self.create_warden()

        # Create 5 students
        students = self.create_students()

        # Create mess rates for 5 months
        mess_rates = self.create_mess_rates(contractor)

        # Create billing cycles
        self.create_billing_cycles(contractor)

        # Create attendance records (5 months)
        self.create_attendance(students, contractor, mess_rates)

        # Create bills for each student/month
        bills = self.create_bills(students, contractor, mess_rates)

        # Create payments for some bills
        self.create_payments(bills, warden)

        # Create a few disputes
        self.create_disputes(bills)

        self.stdout.write(self.style.SUCCESS('\n=== Sample Data Created Successfully ==='))
        self.print_summary(students, bills)

    def clear_all_data(self):
        self.stdout.write('Clearing all existing data...')
        AuditLog.objects.all().delete()
        Payment.objects.all().delete()
        Dispute.objects.all().delete()
        Bill.objects.all().delete()
        Attendance.objects.all().delete()
        BillingCycle.objects.all().delete()
        MessRate.objects.all().delete()
        User.objects.filter(role='student').delete()
        User.objects.filter(username__in=['contractor', 'warden']).delete()
        self.stdout.write(self.style.SUCCESS('  All data cleared.'))

    def ensure_groups(self):
        for name in ['student', 'contractor', 'warden']:
            Group.objects.get_or_create(name=name)

    def create_contractor(self):
        self.stdout.write('Creating contractor...')
        contractor_group, _ = Group.objects.get_or_create(name='contractor')
        contractor, created = User.objects.get_or_create(
            username='contractor',
            defaults={
                'email': 'contractor@messbilling.edu',
                'first_name': 'Rajesh',
                'last_name': 'Caterer',
                'role': 'contractor',
                'phone': '+91 9876543210',
            }
        )
        if created:
            contractor.set_password('demo1234')
            contractor.save()
            contractor.groups.add(contractor_group)
        return contractor

    def create_warden(self):
        self.stdout.write('Creating warden...')
        warden_group, _ = Group.objects.get_or_create(name='warden')
        warden, created = User.objects.get_or_create(
            username='warden',
            defaults={
                'email': 'warden@messbilling.edu',
                'first_name': 'Dr. Suresh',
                'last_name': 'Kumar',
                'role': 'warden',
                'phone': '+91 9876543211',
            }
        )
        if created:
            warden.set_password('demo1234')
            warden.save()
            warden.groups.add(warden_group)
        return warden

    def create_students(self):
        self.stdout.write('Creating 5 students...')
        students = []
        student_group, _ = Group.objects.get_or_create(name='student')

        for s in STUDENTS:
            user, created = User.objects.get_or_create(
                username=s['username'],
                defaults={
                    'email': f"{s['username']}@student.edu",
                    'first_name': s['first_name'],
                    'last_name': s['last_name'],
                    'role': 'student',
                    'enrollment_number': s['enrollment'],
                    'hostel': s['hostel'],
                    'room_number': s['room'],
                    'phone': s['phone'],
                }
            )
            if created:
                user.set_password('demo1234')
                user.save()
                user.groups.add(student_group)
            # Store pattern on user object for attendance creation
            user._pattern = s['pattern']
            students.append(user)

        self.stdout.write(self.style.SUCCESS(f'  Created {len(students)} students'))
        return students

    def create_mess_rates(self, contractor):
        self.stdout.write('Creating mess rates for 5 months...')
        rates = []
        today = date.today()

        # Create rates for current month and 4 previous months
        for i in range(5):
            month_offset = i
            target_date = today.replace(day=1) - timedelta(days=month_offset * 28)
            target_month = target_date.month
            target_year = target_date.year

            # Rates: Rs 40 lunch, Rs 40 dinner (Rs 80/day combined)
            rate, _ = MessRate.objects.get_or_create(
                month=target_month,
                year=target_year,
                defaults={
                    'lunch_rate': Decimal('40.00'),
                    'dinner_rate': Decimal('40.00'),
                    'is_active': True,
                    'created_by': contractor,
                }
            )
            rates.append(rate)

        self.stdout.write(self.style.SUCCESS(f'  Created {len(rates)} mess rates'))
        return rates

    def create_billing_cycles(self, contractor):
        self.stdout.write('Creating billing cycles...')
        today = date.today()

        for i in range(5):
            target_date = today.replace(day=1) - timedelta(days=i * 28)
            month = target_date.month
            year = target_date.year

            # Current month is open, others are closed/billed
            if i == 0:
                status = 'billed'
            else:
                status = 'closed'

            BillingCycle.objects.get_or_create(
                month=month,
                year=year,
                defaults={
                    'status': status,
                    'created_by': contractor,
                }
            )

    def create_attendance(self, students, contractor, mess_rates):
        self.stdout.write('Creating attendance records...')
        import random
        total = 0
        today = date.today()

        for rate in mess_rates:
            # Get all days in this month
            _, days_in_month = calendar.monthrange(rate.year, rate.month)
            month_start = date(rate.year, rate.month, 1)
            month_end = date(rate.year, rate.month, days_in_month)

            # Don't create attendance for future dates
            if month_end > today:
                month_end = today

            for student in students:
                pattern = ATTENDANCE_PATTERNS.get(student._pattern, ATTENDANCE_PATTERNS['average'])
                current = month_start

                while current <= month_end:
                    is_weekend = current.weekday() >= 5

                    # Determine attendance based on pattern
                    if is_weekend and random.random() < pattern['weekend_skip_prob']:
                        lunch = False
                        dinner = False
                    else:
                        lunch = random.random() < pattern['lunch_prob']
                        dinner = random.random() < pattern['dinner_prob']

                    Attendance.objects.get_or_create(
                        student=student,
                        date=current,
                        defaults={
                            'lunch': lunch,
                            'dinner': dinner,
                            'marked_by': contractor,
                        }
                    )
                    total += 1
                    current += timedelta(days=1)

        self.stdout.write(self.style.SUCCESS(f'  Created {total} attendance records'))

    def create_bills(self, students, contractor, mess_rates):
        self.stdout.write('Creating bills...')
        bills = []
        today = date.today()

        for rate in mess_rates:
            # Due date: 15th of next month
            if rate.month == 12:
                due_date = date(rate.year + 1, 1, 15)
            else:
                due_date = date(rate.year, rate.month + 1, 15)

            for student in students:
                # Calculate attendance
                attendance = Attendance.objects.filter(
                    student=student,
                    date__month=rate.month,
                    date__year=rate.year
                )
                lunch_days = attendance.filter(lunch=True).count()
                dinner_days = attendance.filter(dinner=True).count()

                total_amount = (
                    Decimal(lunch_days) * rate.lunch_rate +
                    Decimal(dinner_days) * rate.dinner_rate
                )

                # Determine status based on month age
                month_diff = (today.year - rate.year) * 12 + (today.month - rate.month)

                if month_diff >= 4:
                    status = 'paid'
                elif month_diff >= 2:
                    # Mix of paid and pending for older months
                    if student._pattern in ['regular', 'good']:
                        status = 'paid'
                    else:
                        status = 'pending' if month_diff == 2 else 'paid'
                elif month_diff == 1:
                    # Last month - mostly pending
                    if student._pattern == 'regular':
                        status = 'paid'
                    else:
                        status = 'pending'
                else:
                    # Current month
                    status = 'pending'

                bill, _ = Bill.objects.get_or_create(
                    student=student,
                    month=rate.month,
                    year=rate.year,
                    defaults={
                        'lunch_days': lunch_days,
                        'dinner_days': dinner_days,
                        'lunch_rate': rate.lunch_rate,
                        'dinner_rate': rate.dinner_rate,
                        'total_amount': total_amount,
                        'status': status,
                        'generated_by': contractor,
                        'due_date': due_date,
                    }
                )
                bills.append(bill)

        self.stdout.write(self.style.SUCCESS(f'  Created {len(bills)} bills'))
        return bills

    def create_payments(self, bills, warden):
        self.stdout.write('Creating payments...')
        import random
        count = 0

        payment_methods = ['upi', 'online', 'cash']

        for bill in bills:
            if bill.status == 'paid':
                Payment.objects.get_or_create(
                    bill=bill,
                    student=bill.student,
                    defaults={
                        'amount': bill.total_amount,
                        'payment_method': random.choice(payment_methods),
                        'transaction_id': f'TXN{bill.id}{random.randint(10000, 99999)}',
                        'status': 'verified',
                        'verified_by': warden,
                        'notes': 'Payment verified',
                    }
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created {count} payments'))

    def create_disputes(self, bills):
        self.stdout.write('Creating sample disputes...')
        # Create 1-2 disputes for demonstration
        pending_bills = [b for b in bills if b.status == 'pending']

        if pending_bills:
            bill = pending_bills[0]
            Dispute.objects.get_or_create(
                bill=bill,
                raised_by=bill.student,
                defaults={
                    'dispute_type': 'attendance',
                    'description': 'I was marked absent on 3 days when I had lunch. Please verify the attendance records.',
                    'status': 'open',
                }
            )
            self.stdout.write(self.style.SUCCESS('  Created 1 sample dispute'))

    def print_summary(self, students, bills):
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('LOGIN CREDENTIALS:'))
        self.stdout.write('  Contractor: contractor / demo1234')
        self.stdout.write('  Warden:     warden / demo1234')
        self.stdout.write('\n  Students (all passwords: demo1234):')
        for s in students:
            self.stdout.write(f'    - {s.username} ({s.first_name} {s.last_name})')

        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('BILLS SUMMARY:'))
        for student in students:
            student_bills = [b for b in bills if b.student == student]
            total = sum(b.total_amount for b in student_bills)
            paid = sum(b.total_amount for b in student_bills if b.status == 'paid')
            pending = sum(b.total_amount for b in student_bills if b.status == 'pending')
            self.stdout.write(
                f'  {student.first_name:10} - Total: Rs {total:>7}, Paid: Rs {paid:>7}, Pending: Rs {pending:>7}'
            )
        self.stdout.write('='*60 + '\n')
