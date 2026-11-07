"""Utilidades compartidas por los tests."""
import re
from datetime import timedelta

from django.core import mail
from django.utils import timezone

from accounts.models import OTPCode

BASE = '/api/v1/auth'
REGISTER = f'{BASE}/register/'
REGISTER_VERIFY = f'{BASE}/register/verify/'
REGISTER_RESEND = f'{BASE}/register/resend/'
LOGIN = f'{BASE}/login/'
TWO_FA_VERIFY = f'{BASE}/2fa/verify/'
TWO_FA_RESEND = f'{BASE}/2fa/resend/'
REFRESH = f'{BASE}/token/refresh/'
ME = f'{BASE}/me/'


def post(api, url, payload):
    return api.post(url, payload, format='json')


def last_code():
    """Código de 6 dígitos del último correo enviado (lo que vería el usuario)."""
    match = re.search(r'\b(\d{6})\b', mail.outbox[-1].body)
    assert match, 'El correo no contiene un código de 6 dígitos'
    return match.group(1)


def wrong_code(code):
    return '000000' if code != '000000' else '111111'


def age_otp(challenge_id, seconds):
    """Envejece un OTP simulando que se emitió hace `seconds` segundos."""
    OTPCode.objects.filter(challenge_id=challenge_id).update(created_at=timezone.now() - timedelta(seconds=seconds))
