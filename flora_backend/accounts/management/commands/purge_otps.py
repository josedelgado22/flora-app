"""Limpieza periódica: borra OTP antiguos y cuentas que nunca se verificaron."""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import OTPCode, User


class Command(BaseCommand):
    help = 'Elimina códigos OTP antiguos y cuentas sin verificar (Render Cron Job o ejecución manual).'

    def add_arguments(self, parser):
        parser.add_argument('--hours', type=int, default=24, help='Antigüedad máxima de los OTP (horas).')
        parser.add_argument('--unverified-days', type=int, default=7, help='Días antes de borrar cuentas sin verificar.')

    def handle(self, *args, **options):
        now = timezone.now()
        otp_count, _ = OTPCode.objects.filter(created_at__lt=now - timedelta(hours=options['hours'])).delete()
        user_count, _ = User.objects.filter(
            is_active=False,
            is_staff=False,
            last_login__isnull=True,
            fecha_registro__lt=now - timedelta(days=options['unverified_days']),
        ).delete()
        self.stdout.write(self.style.SUCCESS(f'OTP eliminados: {otp_count} · registros sin verificar: {user_count}'))
