"""
Replace total_days_present/daily_rate with lunch_days/dinner_days/lunch_rate/dinner_rate on Bill.
"""

from decimal import Decimal
from django.db import migrations, models


def migrate_bill_data(apps, schema_editor):
    """Convert old fields to new lunch/dinner breakdown."""
    Bill = apps.get_model('billing', 'Bill')
    for bill in Bill.objects.all():
        bill.lunch_days = bill.total_days_present
        bill.dinner_days = bill.total_days_present
        half = bill.daily_rate / Decimal('2')
        bill.lunch_rate = half
        bill.dinner_rate = half
        bill.save(update_fields=['lunch_days', 'dinner_days', 'lunch_rate', 'dinner_rate'])


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
    ]

    operations = [
        # Step 1: Add new fields with defaults
        migrations.AddField(
            model_name='bill',
            name='lunch_days',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='bill',
            name='dinner_days',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='bill',
            name='lunch_rate',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
        migrations.AddField(
            model_name='bill',
            name='dinner_rate',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),

        # Step 2: Migrate existing data
        migrations.RunPython(migrate_bill_data, migrations.RunPython.noop),

        # Step 3: Remove old fields
        migrations.RemoveField(
            model_name='bill',
            name='total_days_present',
        ),
        migrations.RemoveField(
            model_name='bill',
            name='daily_rate',
        ),
    ]
