"""
Replace is_present with lunch/dinner booleans on Attendance,
and daily_rate with lunch_rate/dinner_rate on MessRate.
"""

from decimal import Decimal
from django.db import migrations, models


def migrate_attendance_data(apps, schema_editor):
    """Convert is_present -> lunch + dinner fields."""
    Attendance = apps.get_model('attendance', 'Attendance')
    for record in Attendance.objects.all():
        if record.is_present:
            record.lunch = True
            record.dinner = True
        else:
            record.lunch = False
            record.dinner = False
        record.save(update_fields=['lunch', 'dinner'])


def migrate_messrate_data(apps, schema_editor):
    """Convert daily_rate -> lunch_rate + dinner_rate (split equally)."""
    MessRate = apps.get_model('attendance', 'MessRate')
    for rate in MessRate.objects.all():
        half = rate.daily_rate / Decimal('2')
        rate.lunch_rate = half
        rate.dinner_rate = half
        rate.save(update_fields=['lunch_rate', 'dinner_rate'])


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0001_initial'),
    ]

    operations = [
        # Step 1: Add new fields with defaults
        migrations.AddField(
            model_name='attendance',
            name='lunch',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='attendance',
            name='dinner',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='messrate',
            name='lunch_rate',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='messrate',
            name='dinner_rate',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
            preserve_default=False,
        ),

        # Step 2: Migrate existing data
        migrations.RunPython(migrate_attendance_data, migrations.RunPython.noop),
        migrations.RunPython(migrate_messrate_data, migrations.RunPython.noop),

        # Step 3: Remove old fields
        migrations.RemoveField(
            model_name='attendance',
            name='is_present',
        ),
        migrations.RemoveField(
            model_name='messrate',
            name='daily_rate',
        ),
    ]
