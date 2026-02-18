"""
Management command to seed comprehensive demo data for the Mess Billing System.
Creates 50 students, 6 months of attendance, bills, payments, disputes, and audit logs.
"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand
from django.utils import timezone

from attendance.models import Attendance, MessRate
from billing.models import Bill
from disputes.models import Dispute
from payments.models import Payment
from audit_logs.models import AuditLog

User = get_user_model()

# Sample data for realistic names
FIRST_NAMES = [
    'Aakash', 'Aanya', 'Aditya', 'Ananya', 'Arjun', 'Bhavya', 'Chetan', 'Deepak',
    'Esha', 'Gaurav', 'Harsh', 'Ishaan', 'Jaya', 'Karan', 'Lakshmi', 'Manish',
    'Neha', 'Omkar', 'Priya', 'Rahul', 'Sakshi', 'Tanuj', 'Uma', 'Vikram',
    'Yash', 'Zara', 'Abhishek', 'Bhargav', 'Chitra', 'Divya', 'Ekta', 'Faisal',
    'Gauri', 'Hemant', 'Isha', 'Jayesh', 'Kavya', 'Lokesh', 'Meera', 'Nikhil',
    'Ojas', 'Pooja', 'Ravi', 'Sneha', 'Tarun', 'Urvashi', 'Varun', 'Yogesh',
    'Aarav', 'Kiara'
]

LAST_NAMES = [
    'Sharma', 'Patel', 'Kumar', 'Singh', 'Reddy', 'Gupta', 'Jain', 'Verma',
    'Agarwal', 'Bhat', 'Choudhary', 'Das', 'Fernandes', 'Ghosh', 'Hegde',
    'Iyer', 'Joshi', 'Khan', 'Lal', 'Menon', 'Nair', 'Pandey', 'Rao', 'Saxena',
    'Thakur', 'Upadhyay', 'Varma', 'Yadav', 'Malik', 'Chopra'
]

HOSTELS = ['Hostel A', 'Hostel B', 'Hostel C', 'Hostel D', 'Hostel E']


class Command(BaseCommand):
    help = 'Seed comprehensive demo data: 50 students, 6 months attendance, bills, payments, disputes'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing data before seeding',
        )
        parser.add_argument(
            '--students',
            type=int,
            default=50,
            help='Number of students to create (default: 50)',
        )

    def handle(self, *args, **options):
        if options['clear']:
            self.clear_data()

        num_students = options['students']
        
        self.stdout.write(self.style.WARNING(f'\n=== Seeding Demo Data ({num_students} students, 6 months) ===\n'))

        # Ensure groups exist
        self.ensure_groups()

        # Create users
        users = self.create_users(num_students)
        
        # Create mess rates for 6 months
        mess_rates = self.create_mess_rates(users['contractor'])
        
        # Create attendance for 6 months
        self.create_attendance(users['students'], users['contractor'])
        
        # Create bills
        bills = self.create_bills(users['students'], users['contractor'], mess_rates)
        
        # Create payments
        self.create_payments(users['students'], bills)
        
        # Create disputes
        self.create_disputes(users['students'], bills)
        
        # Create audit logs
        self.create_audit_logs(users)
        
        self.stdout.write(self.style.SUCCESS('\n=== Demo Data Seeding Complete ==='))
        self.stdout.write(self.style.SUCCESS('\nLogin credentials:'))
        self.stdout.write('  Student:    student01 / demo1234')
        self.stdout.write('  Contractor: contractor / demo1234')
        self.stdout.write('  Warden:     warden / demo1234')
        self.stdout.write(f'\n  Total students created: {len(users["students"])}')

    def clear_data(self):
        self.stdout.write('Clearing existing data...')
        AuditLog.objects.all().delete()
        Payment.objects.all().delete()
        Dispute.objects.all().delete()
        Bill.objects.all().delete()
        Attendance.objects.all().delete()
        MessRate.objects.all().delete()
        User.objects.filter(role='student', username__startswith='student').delete()
        self.stdout.write(self.style.SUCCESS('  Existing data cleared.'))

    def ensure_groups(self):
        """Ensure groups exist"""
        for name in ['student', 'contractor', 'warden']:
            Group.objects.get_or_create(name=name)

    def create_users(self, num_students):
        self.stdout.write(f'Creating {num_students} students + contractor + warden...')
        
        students = []
        student_group, _ = Group.objects.get_or_create(name='student')
        
        for i in range(1, num_students + 1):
            username = f'student{i:02d}'
            first_name = random.choice(FIRST_NAMES)
            last_name = random.choice(LAST_NAMES)
            hostel = random.choice(HOSTELS)
            room = f'{random.randint(1, 4)}{random.randint(0, 1)}{random.randint(1, 9)}'
            
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'email': f'{username}@messbilling.edu',
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': 'student',
                    'enrollment_number': f'ENR-2024-{i:03d}',
                    'hostel': hostel,
                    'room_number': room,
                    'phone': f'+91 98{random.randint(10000000, 99999999)}',
                }
            )
            if created:
                user.set_password('demo1234')
                user.save()
                user.groups.add(student_group)
            students.append(user)

        # Create contractor
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

        # Create warden
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

        self.stdout.write(self.style.SUCCESS(f'  Created {len(students)} students, 1 contractor, 1 warden'))
        return {'students': students, 'contractor': contractor, 'warden': warden}

    def create_mess_rates(self, contractor):
        self.stdout.write('Creating mess rates for 6 months...')
        
        today = date.today()
        rates = []
        
        for i in range(6):
            # Go back 5 months to current month
            month_offset = 5 - i
            target_month = today.month - month_offset
            target_year = today.year
            
            while target_month <= 0:
                target_month += 12
                target_year -= 1
            
            while target_month > 12:
                target_month -= 12
                target_year += 1
            
            # Varying rates with slight increases over time
            base_lunch = Decimal('50') + Decimal(i * 2)
            base_dinner = Decimal('60') + Decimal(i * 2)
            
            rate, _ = MessRate.objects.get_or_create(
                month=target_month,
                year=target_year,
                defaults={
                    'lunch_rate': base_lunch,
                    'dinner_rate': base_dinner,
                    'is_active': True,
                    'created_by': contractor,
                }
            )
            rates.append(rate)
        
        self.stdout.write(self.style.SUCCESS(f'  Created {len(rates)} mess rates'))
        return rates

    def create_attendance(self, students, contractor):
        self.stdout.write('Creating 6 months of attendance records...')
        
        today = date.today()
        total_records = 0
        
        for student in students:
            # Create attendance for last 6 months
            for month_offset in range(6):
                month_start = today.replace(day=1) - timedelta(days=month_offset * 30)
                
                # Get first and last day of that month
                if month_start.month == 12:
                    next_month = month_start.replace(year=month_start.year + 1, month=1, day=1)
                else:
                    next_month = month_start.replace(month=month_start.month + 1, day=1)
                
                month_end = next_month - timedelta(days=1)
                
                # Don't create attendance for future dates
                if month_end > today:
                    month_end = today
                
                current = month_start
                while current <= month_end:
                    # Random attendance pattern (70% chance of lunch, 75% chance of dinner)
                    lunch = random.random() < 0.70
                    dinner = random.random() < 0.75
                    
                    # Skip weekends occasionally
                    if current.weekday() >= 5 and random.random() < 0.3:
                        lunch = False
                        dinner = False
                    
                    Attendance.objects.get_or_create(
                        student=student,
                        date=current,
                        defaults={
                            'lunch': lunch,
                            'dinner': dinner,
                            'marked_by': contractor,
                        }
                    )
                    total_records += 1
                    current += timedelta(days=1)
        
        self.stdout.write(self.style.SUCCESS(f'  Created ~{total_records} attendance records'))

    def create_bills(self, students, contractor, mess_rates):
        self.stdout.write('Creating bills for all students...')
        
        bills = []
        today = date.today()
        
        for rate in mess_rates:
            # Set due date to 15th of next month
            if rate.month == 12:
                due_date = date(rate.year + 1, 1, 15)
            else:
                due_date = date(rate.year, rate.month + 1, 15)
            
            for student in students:
                # Calculate attendance for this month
                attendance_records = Attendance.objects.filter(
                    student=student,
                    date__month=rate.month,
                    date__year=rate.year
                )
                
                lunch_days = attendance_records.filter(lunch=True).count()
                dinner_days = attendance_records.filter(dinner=True).count()
                
                total_amount = (
                    Decimal(lunch_days) * rate.lunch_rate +
                    Decimal(dinner_days) * rate.dinner_rate
                )
                
                # Random status distribution
                # Older months more likely to be paid
                month_diff = (today.year - rate.year) * 12 + (today.month - rate.month)
                
                if month_diff >= 3:
                    # Older bills - mostly paid
                    status_choices = ['paid'] * 8 + ['pending'] * 1 + ['disputed'] * 1
                elif month_diff >= 1:
                    # Recent bills - mixed
                    status_choices = ['paid'] * 5 + ['pending'] * 3 + ['disputed'] * 1 + ['overdue'] * 1
                else:
                    # Current month - mostly pending
                    status_choices = ['pending'] * 7 + ['paid'] * 2 + ['disputed'] * 1
                
                status = random.choice(status_choices)
                
                bill, created = Bill.objects.get_or_create(
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

    def create_payments(self, students, bills):
        self.stdout.write('Creating payments for paid bills...')
        
        payment_methods = ['cash', 'online', 'upi', 'cheque']
        payments_created = 0
        
        for bill in bills:
            if bill.status in ['paid', 'partially_paid']:
                # Create payment for the full amount
                Payment.objects.get_or_create(
                    bill=bill,
                    student=bill.student,
                    defaults={
                        'amount': bill.total_amount,
                        'payment_method': random.choice(payment_methods),
                        'transaction_id': f'TXN{random.randint(100000, 999999)}' if random.random() > 0.3 else '',
                        'status': 'verified',
                        'notes': '',
                    }
                )
                payments_created += 1
            
            elif bill.status == 'pending' and random.random() < 0.2:
                # Some pending bills have pending payments
                Payment.objects.get_or_create(
                    bill=bill,
                    student=bill.student,
                    defaults={
                        'amount': bill.total_amount,
                        'payment_method': random.choice(payment_methods),
                        'transaction_id': f'TXN{random.randint(100000, 999999)}',
                        'status': 'pending',
                        'notes': '',
                    }
                )
                payments_created += 1
        
        self.stdout.write(self.style.SUCCESS(f'  Created {payments_created} payments'))

    def create_disputes(self, students, bills):
        self.stdout.write('Creating sample disputes...')
        
        dispute_types = ['billing', 'attendance']
        dispute_reasons = [
            'Incorrect attendance count for the month',
            'Bill amount does not match mess usage',
            'Marked absent on days I was present',
            'Wrong rate applied to my bill',
            'Duplicate bill generated',
            'Need correction in lunch count',
        ]
        
        disputes_created = 0
        
        for bill in bills:
            if bill.status == 'disputed':
                Dispute.objects.get_or_create(
                    bill=bill,
                    raised_by=bill.student,
                    defaults={
                        'dispute_type': random.choice(dispute_types),
                        'description': random.choice(dispute_reasons),
                        'status': random.choice(['open', 'under_review', 'resolved', 'rejected']),
                    }
                )
                disputes_created += 1
            elif random.random() < 0.05:  # 5% chance for non-disputed bills
                Dispute.objects.get_or_create(
                    bill=bill,
                    raised_by=bill.student,
                    defaults={
                        'dispute_type': random.choice(dispute_types),
                        'description': random.choice(dispute_reasons),
                        'status': random.choice(['resolved', 'rejected']),
                    }
                )
                disputes_created += 1
        
        self.stdout.write(self.style.SUCCESS(f'  Created {disputes_created} disputes'))

    def create_audit_logs(self, users):
        self.stdout.write('Creating audit log entries...')
        
        actions = ['create', 'update', 'login', 'generate', 'verify']
        models = ['Bill', 'Attendance', 'Payment', 'MessRate', 'Dispute']
        
        all_users = [users['contractor'], users['warden']] + users['students'][:10]
        logs_created = 0
        
        for _ in range(100):
            user = random.choice(all_users)
            action = random.choice(actions)
            model = random.choice(models)
            
            AuditLog.objects.create(
                user=user,
                user_role=user.role,
                action=action,
                model_name=model,
                object_id=random.randint(1, 100),
                description=f'{action.title()} operation on {model}',
                ip_address=f'192.168.1.{random.randint(1, 254)}',
            )
            logs_created += 1
        
        self.stdout.write(self.style.SUCCESS(f'  Created {logs_created} audit log entries'))
