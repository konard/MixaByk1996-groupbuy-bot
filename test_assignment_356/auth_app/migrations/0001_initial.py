from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('first_name', models.CharField(max_length=100)),
                ('last_name', models.CharField(max_length=100)),
                ('patronymic', models.CharField(blank=True, max_length=100)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('password_hash', models.CharField(max_length=200)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'app_label': 'auth_app'},
        ),
        migrations.CreateModel(
            name='Role',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
                ('description', models.CharField(blank=True, max_length=200)),
            ],
            options={'app_label': 'auth_app'},
        ),
        migrations.CreateModel(
            name='BusinessElement',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
                ('description', models.CharField(blank=True, max_length=200)),
            ],
            options={'app_label': 'auth_app'},
        ),
        migrations.CreateModel(
            name='UserRole',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_roles', to='auth_app.user')),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='user_roles', to='auth_app.role')),
            ],
            options={'app_label': 'auth_app', 'unique_together': {('user', 'role')}},
        ),
        migrations.CreateModel(
            name='AccessRoleRule',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='access_rules', to='auth_app.role')),
                ('element', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='access_rules', to='auth_app.businesselement')),
                ('read_permission', models.BooleanField(default=False)),
                ('read_all_permission', models.BooleanField(default=False)),
                ('create_permission', models.BooleanField(default=False)),
                ('update_permission', models.BooleanField(default=False)),
                ('update_all_permission', models.BooleanField(default=False)),
                ('delete_permission', models.BooleanField(default=False)),
                ('delete_all_permission', models.BooleanField(default=False)),
            ],
            options={'app_label': 'auth_app', 'unique_together': {('role', 'element')}},
        ),
        migrations.CreateModel(
            name='Session',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='sessions', to='auth_app.user')),
                ('token', models.CharField(max_length=512, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={'app_label': 'auth_app'},
        ),
    ]
