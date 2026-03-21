# Migration: add selfie_file_id field to User.
# The selfie (a Telegram file_id) is collected during registration for identity
# verification purposes.  It is accessible only to admins and is never returned
# in regular API responses.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_user_first_name_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='selfie_file_id',
            field=models.CharField(blank=True, max_length=255),
        ),
    ]
