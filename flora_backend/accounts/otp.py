"""
Ciclo de vida de los códigos OTP: emitir, reenviar y verificar.

Reglas:
  - 6 dígitos, vence a los OTP_EXPIRY_SECONDS (5 min) y es de UN solo uso.
  - Máximo OTP_MAX_ATTEMPTS intentos fallidos por código (anti fuerza bruta).
  - Reenvío: mismo challenge_id, código nuevo, con enfriamiento de OTP_RESEND_COOLDOWN_SECONDS.
  - El código se guarda como HMAC (campo `code`), nunca en claro.
"""
import math

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .exceptions import APIError
from .models import OTPCode
from .otp_utils import codes_match, generate_code, hash_code


def issue_otp(user, purpose):
    """Crea un desafío nuevo e invalida los pendientes del mismo usuario y propósito."""
    OTPCode.objects.filter(user=user, purpose=purpose, is_used=False).update(is_used=True)

    otp = OTPCode(user=user, purpose=purpose)
    plain_code = generate_code()
    otp.code = hash_code(plain_code, otp.challenge_id, settings.SECRET_KEY)
    otp.save()
    return otp, plain_code


def _get_challenge(challenge_id, purpose, for_update=False):
    queryset = OTPCode.objects.select_related('user').filter(challenge_id=challenge_id, purpose=purpose)
    if for_update:
        queryset = queryset.select_for_update(of=('self',))
    otp = queryset.first()
    if otp is None or otp.is_used:
        raise APIError.challenge_expired()
    return otp


def refresh_otp(challenge_id, purpose):
    """Genera un código nuevo para el MISMO desafío (aunque el anterior ya haya vencido)."""
    with transaction.atomic():
        otp = _get_challenge(challenge_id, purpose, for_update=True)

        elapsed = (timezone.now() - otp.created_at).total_seconds()
        remaining = settings.OTP_RESEND_COOLDOWN_SECONDS - elapsed
        if remaining > 0:
            raise APIError.resend_too_soon(math.ceil(remaining))

        plain_code = generate_code()
        otp.code = hash_code(plain_code, otp.challenge_id, settings.SECRET_KEY)
        otp.created_at = timezone.now()
        otp.attempts = 0
        otp.save(update_fields=['code', 'created_at', 'attempts'])
    return otp, plain_code


def verify_otp(challenge_id, code, purpose):
    """
    Valida el código y lo consume. Devuelve el OTPCode (con .user) o lanza APIError.

    El error se lanza FUERA del bloque atómico para que el contador de intentos
    fallidos quede guardado (si se lanzara dentro, se desharía junto con la transacción).
    NO llamar dentro de otra transaction.atomic() que deba revertirse por el error.
    """
    error = None
    with transaction.atomic():
        otp = _get_challenge(challenge_id, purpose, for_update=True)

        if otp.is_expired:
            error = APIError.challenge_expired()
        elif otp.attempts >= settings.OTP_MAX_ATTEMPTS:
            error = APIError.too_many_attempts()
        elif not codes_match(otp.code, code, otp.challenge_id, settings.SECRET_KEY):
            otp.attempts += 1
            otp.save(update_fields=['attempts'])
            error = APIError.invalid_code()
        else:
            otp.is_used = True
            otp.save(update_fields=['is_used'])

    if error is not None:
        raise error
    return otp
