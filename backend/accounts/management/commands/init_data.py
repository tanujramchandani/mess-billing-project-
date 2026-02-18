import random
from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from attendance.models import Attendance, MessRate
from billing.models import Bill
from disputes.models import Dispute
from payments.models import Payment
from audit_logs.models import AuditLog

User = get_user_model()


class Command(BaseCommand):
    help = 'Initialize groups, permissions, sample users and data'

    def handle(self, *args, **options):
        self.setup_groups()
        users = self.create_users()
        mess_rate = self.create_mess_rates(users['contractor'])
        self.create_attendance(users, users['contractor'])
        bills = self.create_bills(users, mess_rate)
        self.create_payments(users, bills)
        self.create_disputes(users, bills)
        self.create_audit_logs(users)
        self.stdout.write(self.style.SUCCESS('\nAll data initialized successfully!'))
        self.stdout.write(self.style.SUCCESS('\nSample login credentials:'))
        self.stdout.write('  Student:    student1 / pass1234')
        self.stdout.write('  Contractor: contractor1 / pass1234')
        self.stdout.write('  Warden:     warden1 / pass1234')
        self.stdout.write('  Admin:      admin / admin123')

    def setup_groups(self):
        self.stdout.write('Setting up groups and permissions...')

        # Get content types
        user_ct = ContentType.objects.get_for_model(User)
        attendance_ct = ContentType.objects.get_for_model(Attendance)
        messrate_ct = ContentType.objects.get_for_model(MessRate)
        bill_ct = ContentType.objects.get_for_model(Bill)
        dispute_ct = ContentType.objects.get_for_model(Dispute)
        payment_ct = ContentType.objects.get_for_model(Payment)
        auditlog_ct = ContentType.objects.get_for_model(AuditLog)

        # --- Student group ---
        student_group, _ = Group.objects.get_or_create(name='student')
        student_perms = []
        # Students can view their own attendance, bills, payments; create disputes and payments
        student_perms += list(Permission.objects.filter(
            content_type=attendance_ct, codename__in=['view_attendance']
        ))
        student_perms += list(Permission.objects.filter(
            content_type=bill_ct, codename__in=['view_bill']
        ))
        student_perms += list(Permission.objects.filter(
            content_type=payment_ct, codename__in=['view_payment', 'add_payment']
        ))
        student_perms += list(Permission.objects.filter(
            content_type=dispute_ct, codename__in=['view_dispute', 'add_dispute']
        ))
        student_perms += list(Permission.objects.filter(
            content_type=messrate_ct, codename__in=['view_messrate']
        ))
        student_group.permissions.set(student_perms)
        self.stdout.write(f'  Student group: {len(student_perms)} permissions')

        # --- Contractor group ---
        contractor_group, _ = Group.objects.get_or_create(name='contractor')
        contractor_perms = []
        # Contractors can manage attendance, mess rates, view/generate bills, respond to disputes
        contractor_perms += list(Permission.objects.filter(
            content_type=attendance_ct,
            codename__in=['view_attendance', 'add_attendance', 'change_attendance']
        ))
        contractor_perms += list(Permission.objects.filter(
            content_type=messrate_ct,
            codename__in=['view_messrate', 'add_messrate', 'change_messrate']
        ))
        contractor_perms += list(Permission.objects.filter(
            content_type=bill_ct,
            codename__in=['view_bill', 'add_bill', 'change_bill']
        ))
        contractor_perms += list(Permission.objects.filter(
            content_type=dispute_ct,
            codename__in=['view_dispute', 'change_dispute']
        ))
        contractor_perms += list(Permission.objects.filter(
            content_type=payment_ct,
            codename__in=['view_payment', 'change_payment']
        ))
        contractor_perms += list(Permission.objects.filter(
            content_type=user_ct, codename__in=['view_user']
        ))
        contractor_group.permissions.set(contractor_perms)
        self.stdout.write(f'  Contractor group: {len(contractor_perms)} permissions')

        # --- Warden group ---
        warden_group, _ = Group.objects.get_or_create(name='warden')
        warden_perms = []
        # Wardens have full access to everything
        for ct in [user_ct, attendance_ct, messrate_ct, bill_ct, dispute_ct, payment_ct, auditlog_ct]:
            warden_perms += list(Permission.objects.filter(content_type=ct))
        warden_group.permissions.set(warden_perms)
        self.stdout.write(f'  Warden group: {len(warden_perms)} permissions')

    def create_users(self):
        self.stdout.write('Creating sample users...')

        # Create students
        students = []
        student_data = [
            ('student1', 'Tanuj', 'Sharma', 'ENR-2024-001', 'Hostel A', '101'),
            ('student2', 'Priya', 'Patel', 'ENR-2024-002', 'Hostel B', '205'),
            ('student3', 'Rahul', 'Kumar', 'ENR-2024-003', 'Hostel A', '304'),
            ('student4', 'Ananya', 'Singh', 'ENR-2024-004', 'Hostel C', '102'),
            ('student5', 'Vikram', 'Reddy', 'ENR-2024-005', 'Hostel B', '410'),
        ]
        student_group = Group.objects.get(name='student')
        for uname, first, last, enroll, hostel, room in student_data:
            user, created = User.objects.get_or_create(
                username=uname,
                defaults={
                    'email': f'{uname}@example.com',
                    'first_name': first,
                    'last_name': last,
                    'role': 'student',
                    'enrollment_number': enroll,
                    'hostel': hostel,
                    'room_number': room,
                    'phone': f'+91 98765{random.randint(10000, 99999)}',
                }
            )
            if created:
                user.set_password('pass1234')
                user.save()
                user.groups.add(student_group)
            students.append(user)

        # Create contractor
        contractor_group = Group.objects.get(name='contractor')
        contractor, created = User.objects.get_or_create(
            username='contractor1',
            defaults={
                'email': 'contractor1@example.com',
                'first_name': 'Rajesh',
                'last_name': 'Caterer',
                'role': 'contractor',
                'phone': '+91 9876500001',
            }
        )
        if created:
            contractor.set_password('pass1234')
            contractor.save()
            contractor.groups.add(contractor_group)

        # Create warden
        warden_group = Group.objects.get(name='warden')
        warden, created = User.objects.get_or_create(
            username='warden1',
            defaults={
                'email': 'warden1@example.com',
                'first_name': 'Dr. Suresh',
                'last_name': 'Verma',
                'role': 'warden',
                'phone': '+91 9876500002',
            }
        )
        if created:
            warden.set_password('pass1234')
            warden.save()
            warden.groups.add(warden_group)

        # Ensure admin superuser has warden group too
        try:
            admin_user = User.objects.get(username='admin')
            admin_user.groups.add(warden_group)
        except User.DoesNotExist:
            pass

        self.stdout.write(f'  Created {len(students)} students, 1 contractor, 1 warden')
        return {'students': students, 'contractor': contractor, 'warden': warden}

    def create_mess_rates(self, contractor):
        self.stdout.write('Creating mess rates...')
        today = date.today()
        rates = []
        # Create rates for last 3 months + current month
        for i in range(3, -1, -1):
            d = today.replace(day=1) - timedelta(days=i * 30)
            month = d.month
            year = d.year
            rate, created = MessRate.objects.get_or_create(
                month=month,
                year=year,
                defaults={
                    'daily_rate': Decimal('80.00') + Decimal(str(i * 5)),
                    'is_active': (i == 0),
                    'created_by': contractor,
                }
            )
            if not created and i == 0:
                rate.is_active = True
                rate.save()
            elif not created:
                rate.is_active = False
                rate.save()
            rates.append(rate)

        self.stdout.write(f'  Created {len(rates)} mess rates')
        return rates[-1]  # return current month rate

    def create_attendance(self, users, marked_by):
        self.stdout.write('Creating attendance records...')
        today = date.today()
        count = 0

        for student in users['students']:
            # Create attendance for last 60 days
            for day_offset in range(60, 0, -1):
                d = today - timedelta(days=day_offset)
                # Skip weekends (Sunday)
                if d.weekday() == 6:
                    continue
                # ~80% attendance rate
                is_present = random.random() < 0.80
                _, created = Attendance.objects.get_or_create(
                    student=student,
                    date=d,
                    defaults={
                        'is_present': is_present,
                        'marked_by': marked_by,
                    }
                )
                if created:
                    count += 1

        self.stdout.write(f'  Created {count} attendance records')

    def create_bills(self, users, current_rate):
        self.stdout.write('Creating bills...')
        today = date.today()
        bills = []

        for student in users['students']:
            # Bills for last 2 months
            for i in range(2, 0, -1):
                d = today.replace(day=1) - timedelta(days=i * 30)
                month = d.month
                year = d.year

                # Count attendance for this month
                days_present = Attendance.objects.filter(
                    student=student,
                    date__month=month,
                    date__year=year,
                    is_present=True,
                ).count()

                if days_present == 0:
                    days_present = random.randint(15, 25)

                daily_rate = Decimal('80.00') + Decimal(str(i * 5))
                total = daily_rate * days_present

                # Older bills are mostly paid, recent ones pending
                if i == 2:
                    status = random.choice(['paid', 'paid', 'paid', 'disputed'])
                else:
                    status = random.choice(['pending', 'pending', 'overdue', 'paid'])

                due_date = date(year, month, 28) if month != 2 else date(year, month, 25)
                if due_date < today and status == 'pending':
                    status = 'overdue'

                bill, created = Bill.objects.get_or_create(
                    student=student,
                    month=month,
                    year=year,
                    defaults={
                        'total_days_present': days_present,
                        'daily_rate': daily_rate,
                        'total_amount': total,
                        'status': status,
                        'generated_by': users['contractor'],
                        'due_date': due_date,
                        'notes': f'Mess bill for {month}/{year}',
                    }
                )
                bills.append(bill)

        self.stdout.write(f'  Created {len(bills)} bills')
        return bills

    def create_payments(self, users, bills):
        self.stdout.write('Creating payments...')
        count = 0

        for bill in bills:
            if bill.status in ('paid',):
                payment, created = Payment.objects.get_or_create(
                    bill=bill,
                    student=bill.student,
                    defaults={
                        'amount': bill.total_amount,
                        'payment_method': random.choice(['cash', 'online', 'cheque']),
                        'transaction_id': f'TXN{random.randint(100000, 999999)}',
                        'status': 'verified',
                        'verified_by': users['contractor'],
                        'notes': 'Payment verified',
                    }
                )
                if created:
                    count += 1
            elif bill.status in ('pending', 'overdue'):
                # Some pending bills have unverified payments
                if random.random() < 0.3:
                    payment, created = Payment.objects.get_or_create(
                        bill=bill,
                        student=bill.student,
                        defaults={
                            'amount': bill.total_amount,
                            'payment_method': 'online',
                            'transaction_id': f'TXN{random.randint(100000, 999999)}',
                            'status': 'pending',
                            'notes': 'Awaiting verification',
                        }
                    )
                    if created:
                        count += 1

        self.stdout.write(f'  Created {count} payments')

    def create_disputes(self, users, bills):
        self.stdout.write('Creating disputes...')
        count = 0

        for bill in bills:
            if bill.status == 'disputed':
                dispute, created = Dispute.objects.get_or_create(
                    bill=bill,
                    raised_by=bill.student,
                    defaults={
                        'dispute_type': random.choice(['billing', 'attendance']),
                        'description': random.choice([
                            'I was marked absent on days I was present. Please check the records.',
                            'The daily rate applied seems incorrect for this month.',
                            'I have attendance proof for the disputed days.',
                            'Bill amount does not match my calculation based on attendance.',
                        ]),
                        'status': random.choice(['open', 'under_review']),
                    }
                )
                if created:
                    count += 1
                    # Add contractor response to some
                    if dispute.status == 'under_review':
                        dispute.contractor_response = 'We are reviewing the attendance records. Will update soon.'
                        dispute.save()

        # Add a resolved dispute for variety
        paid_bills = [b for b in bills if b.status == 'paid']
        if paid_bills:
            bill = paid_bills[0]
            dispute, created = Dispute.objects.get_or_create(
                bill=bill,
                raised_by=bill.student,
                defaults={
                    'dispute_type': 'attendance',
                    'description': 'Was marked absent on 3 days when I was present.',
                    'status': 'resolved',
                    'contractor_response': 'Attendance records have been corrected.',
                    'resolved_by': users['warden'],
                    'resolution_notes': 'Attendance corrected after verification. Bill adjusted.',
                }
            )
            if created:
                count += 1

        self.stdout.write(f'  Created {count} disputes')

    def create_audit_logs(self, users):
        self.stdout.write('Creating audit log entries...')
        logs = [
            {'user': users['contractor'], 'action': 'create', 'model_name': 'MessRate',
             'changes': {'daily_rate': '80.00', 'month': date.today().month}},
            {'user': users['contractor'], 'action': 'create', 'model_name': 'Attendance',
             'changes': {'students_marked': 5, 'date': str(date.today() - timedelta(days=1))}},
            {'user': users['contractor'], 'action': 'generate', 'model_name': 'Bill',
             'changes': {'bills_generated': 5, 'month': date.today().month}},
            {'user': users['students'][0], 'action': 'create', 'model_name': 'Dispute',
             'changes': {'type': 'attendance', 'bill_month': date.today().month}},
            {'user': users['students'][0], 'action': 'create', 'model_name': 'Payment',
             'changes': {'method': 'online', 'amount': '1600.00'}},
            {'user': users['warden'], 'action': 'resolve', 'model_name': 'Dispute',
             'changes': {'status': 'resolved', 'notes': 'Attendance corrected'}},
            {'user': users['contractor'], 'action': 'verify', 'model_name': 'Payment',
             'changes': {'status': 'verified'}},
            {'user': users['warden'], 'action': 'login', 'model_name': 'User',
             'changes': {}},
        ]
        count = 0
        for log_data in logs:
            AuditLog.objects.create(
                user=log_data['user'],
                action=log_data['action'],
                model_name=log_data['model_name'],
                changes=log_data['changes'],
                ip_address='127.0.0.1',
            )
            count += 1

        self.stdout.write(f'  Created {count} audit log entries')
