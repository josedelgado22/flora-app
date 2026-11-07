"""Envío del código OTP por correo (SMTP configurable: Gmail, Resend, Brevo...)."""
import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import escape

from .exceptions import APIError
from .models import OTPCode

logger = logging.getLogger(__name__)

SUBJECTS = {
    OTPCode.Purpose.REGISTER: 'Confirma tu correo en F.L.O.R.A.',
    OTPCode.Purpose.LOGIN: 'Tu código de verificación de F.L.O.R.A.',
}

INTROS = {
    OTPCode.Purpose.REGISTER: 'Tu código para activar tu cuenta de F.L.O.R.A. es:',
    OTPCode.Purpose.LOGIN: 'Tu código para iniciar sesión en F.L.O.R.A. es:',
}


def send_otp_email(user, code, purpose):
    """Envía el código. Si falla lanza APIError 503 (el llamador revierte la transacción)."""
    minutes = max(1, settings.OTP_EXPIRY_SECONDS // 60)
    intro = INTROS[purpose]

    text = (
        f'Hola {user.nombre},\n\n'
        f'{intro}\n\n'
        f'    {code}\n\n'
        f'El código vence en {minutes} minutos y solo puede usarse una vez.\n'
        f'Si no fuiste tú, ignora este mensaje.\n\n'
        f'— Equipo F.L.O.R.A.\n'
    )
    html = (
        '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1a1a1a">'
        f'<p>Hola {escape(user.nombre)},</p>'
        f'<p>{escape(intro)}</p>'
        f'<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">{code}</p>'
        f'<p>El código vence en {minutes} minutos y solo puede usarse una vez.<br>'
        'Si no fuiste tú, ignora este mensaje.</p>'
        '<p style="color:#7ba44d">— Equipo F.L.O.R.A.</p></div>'
    )

    message = EmailMultiAlternatives(SUBJECTS[purpose], text, settings.DEFAULT_FROM_EMAIL, [user.email])
    message.attach_alternative(html, 'text/html')

    try:
        message.send(fail_silently=False)
    except Exception:  # SMTPException, timeouts de red, credenciales inválidas...
        # Nunca se registra el código; solo el id de la cuenta.
        logger.exception('No se pudo enviar el correo OTP (cuenta %s, propósito %s).', user.pk, purpose)
        raise APIError.email_send_failed()
