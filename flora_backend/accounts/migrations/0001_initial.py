# Migración escrita a mano (equivale a `makemigrations accounts`).
# Verifica con:  python manage.py makemigrations --check --dry-run
# Si Django propone cambios, borra este archivo y ejecuta: python manage.py makemigrations accounts
import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

import accounts.models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(default=False, help_text='Designates that this user has all permissions without explicitly assigning them.', verbose_name='superuser status')),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('nombre', models.CharField(max_length=100)),
                ('apellido', models.CharField(max_length=100)),
                ('is_active', models.BooleanField(default=True)),
                ('is_staff', models.BooleanField(default=False)),
                ('two_factor_enabled', models.BooleanField(default=True)),
                ('fecha_registro', models.DateTimeField(default=django.utils.timezone.now)),
                ('groups', models.ManyToManyField(blank=True, help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.', related_name='user_set', related_query_name='user', to='auth.group', verbose_name='groups')),
                ('user_permissions', models.ManyToManyField(blank=True, help_text='Specific permissions for this user.', related_name='user_set', related_query_name='user', to='auth.permission', verbose_name='user permissions')),
            ],
            options={
                'verbose_name': 'cuenta',
                'verbose_name_plural': 'cuentas',
                'db_table': 'cuentas',
            },
            managers=[
                ('objects', accounts.models.UserManager()),
            ],
        ),
        migrations.CreateModel(
            name='OTPCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('challenge_id', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ('purpose', models.CharField(choices=[('register', 'Registro'), ('login', 'Inicio de sesión')], max_length=10)),
                ('code', models.CharField(max_length=64)),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('is_used', models.BooleanField(default=False)),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='otp_codes', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'codigos_otp',
            },
        ),
        migrations.AddIndex(
            model_name='otpcode',
            index=models.Index(fields=['user', 'purpose', 'is_used'], name='idx_otp_user_purpose_used'),
        ),
    ]
