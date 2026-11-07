from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone

from accounts import otp as otp_service
from accounts.models import OTPCode, User

pytestmark = pytest.mark.django_db


def test_purge_removes_old_otps_and_unverified_accounts():
    old_pending = User.objects.create_user(
        email='viejo@flora.cl', password='Clave1234', nombre='Viejo', apellido='Pendiente', is_active=False
    )
    User.objects.filter(pk=old_pending.pk).update(fecha_registro=timezone.now() - timedelta(days=8))
    recent_pending = User.objects.create_user(
        email='nuevo@flora.cl', password='Clave1234', nombre='Nuevo', apellido='Pendiente', is_active=False
    )
    active = User.objects.create_user(email='ok@flora.cl', password='Clave1234', nombre='Ok', apellido='Activo')

    stale, _ = otp_service.issue_otp(active, OTPCode.Purpose.LOGIN)
    OTPCode.objects.filter(pk=stale.pk).update(created_at=timezone.now() - timedelta(hours=30))
    fresh, _ = otp_service.issue_otp(recent_pending, OTPCode.Purpose.REGISTER)

    call_command('purge_otps', stdout=StringIO())

    assert not User.objects.filter(pk=old_pending.pk).exists()
    assert User.objects.filter(pk__in=[recent_pending.pk, active.pk]).count() == 2
    assert not OTPCode.objects.filter(pk=stale.pk).exists()
    assert OTPCode.objects.filter(pk=fresh.pk).exists()
