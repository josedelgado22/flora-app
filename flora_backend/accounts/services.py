"""
Casos de uso de autenticación. Las vistas solo validan y delegan aquí.

Contrato con la app móvil: ver src/services/authService.js
"""
from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import update_last_login
from django.db import IntegrityError, transaction
from rest_framework_simplejwt.tokens import RefreshToken

from .emails import send_otp_email
from .exceptions import APIError
from .models import OTPCode, User
from .otp import issue_otp, refresh_otp, verify_otp
from .otp_utils import mask_email
from .serializers import UserSerializer

Purpose = OTPCode.Purpose


def challenge_payload(user, otp, flag):
    """Respuesta que le indica a la app que debe pedir el código."""
    return {
        flag: True,  # 'requires_verification' (registro) o 'requires_2fa' (login)
        'challenge_id': str(otp.challenge_id),
        'method': 'email',
        'email_hint': mask_email(user.email),
        'expires_in': settings.OTP_EXPIRY_SECONDS,
    }


def build_session(user):
    """Emite el par de tokens JWT (HS256) y los datos públicos del usuario."""
    refresh = RefreshToken.for_user(user)
    update_last_login(None, user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UserSerializer(user).data,
    }


# ---------------------------------------------------------------------------
# Registro
# ---------------------------------------------------------------------------
def register_user(*, nombre, apellido, email, password):
    """
    Crea la cuenta INACTIVA y envía el código. Si el correo ya está registrado pero sin
    verificar, se actualizan los datos y se emite un código nuevo (el anterior queda inválido).
    Si el correo no se puede enviar, no queda nada guardado (transacción revertida).
    """
    try:
        with transaction.atomic():
            user = User.objects.select_for_update().filter(email=email).first()

            if user is not None and user.is_active:
                raise APIError.email_exists()

            if user is not None:  # registro pendiente: se reemplaza
                user.nombre = nombre
                user.apellido = apellido
                user.set_password(password)
                user.save(update_fields=['nombre', 'apellido', 'password'])
            else:
                user = User.objects.create_user(
                    email=email, password=password, nombre=nombre, apellido=apellido, is_active=False
                )

            otp, code = issue_otp(user, Purpose.REGISTER)
            send_otp_email(user, code, Purpose.REGISTER)
    except IntegrityError:  # dos registros simultáneos del mismo correo
        raise APIError.email_exists()

    return challenge_payload(user, otp, 'requires_verification')


def activate_account(challenge_id, code):
    """Verifica el correo, activa la cuenta y abre sesión (cuenta como segundo factor)."""
    otp = verify_otp(challenge_id, code, Purpose.REGISTER)
    user = otp.user
    user.is_active = True
    user.save(update_fields=['is_active'])
    return build_session(user)


# ---------------------------------------------------------------------------
# Login + doble factor
# ---------------------------------------------------------------------------
def login_user(*, email, password):
    """
    Paso 1 del login. Devuelve la sesión (sin 2FA) o el desafío 2FA.
    Errores: 401 credenciales inválidas | 403 cuenta sin verificar.
    """
    email = email.strip().lower()
    user = User.objects.filter(email=email).first()

    if user is None:
        make_password(password)  # costo similar: evita revelar por tiempo si el correo existe
        raise APIError.invalid_credentials()
    if not user.check_password(password):
        raise APIError.invalid_credentials()
    if not user.is_active:
        raise APIError.account_not_verified()

    if settings.TWO_FACTOR_REQUIRED and user.two_factor_enabled:
        with transaction.atomic():
            otp, code = issue_otp(user, Purpose.LOGIN)
            send_otp_email(user, code, Purpose.LOGIN)
        return challenge_payload(user, otp, 'requires_2fa')

    return build_session(user)


def complete_two_factor(challenge_id, code):
    """Paso 2 del login: canjea el código por la sesión."""
    otp = verify_otp(challenge_id, code, Purpose.LOGIN)
    if not otp.user.is_active:
        raise APIError.account_not_verified()
    return build_session(otp.user)


# ---------------------------------------------------------------------------
# Reenvío (registro y 2FA)
# ---------------------------------------------------------------------------
def resend_code(challenge_id, purpose):
    """Nuevo código para el mismo desafío. Si el correo falla, el código anterior sigue vigente."""
    with transaction.atomic():
        otp, code = refresh_otp(challenge_id, purpose)
        send_otp_email(otp.user, code, purpose)
    return {'expires_in': settings.OTP_EXPIRY_SECONDS}
