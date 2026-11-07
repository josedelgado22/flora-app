"""
Errores de la API con formato uniforme  { "code": "...", "detail": "..." }
que es justo lo que lee src/services/apiClient.js de la app móvil.
"""
from django.http import Http404
from rest_framework import exceptions as drf
from rest_framework.exceptions import APIException
from rest_framework.views import exception_handler as drf_exception_handler


class APIError(APIException):
    """Error de negocio con código estable para la app."""

    status_code = 400
    default_code = 'error'
    default_detail = 'No se pudo completar la solicitud.'

    def __init__(self, detail=None, code=None, status_code=None):
        if status_code is not None:
            self.status_code = status_code
        super().__init__(detail=detail, code=code)

    # --- Fábricas: un lugar único para mensajes y códigos ---
    @classmethod
    def email_exists(cls):
        return cls('Ya existe una cuenta con ese correo.', 'email_exists', 409)

    @classmethod
    def invalid_credentials(cls):
        return cls('Correo o contraseña incorrectos.', 'invalid_credentials', 401)

    @classmethod
    def account_not_verified(cls):
        return cls(
            'Tu cuenta aún no está verificada. Regístrate de nuevo con el mismo correo para recibir un nuevo código.',
            'account_not_verified',
            403,
        )

    @classmethod
    def challenge_expired(cls):
        return cls('El código expiró. Solicita uno nuevo.', 'challenge_expired', 400)

    @classmethod
    def invalid_code(cls):
        return cls('Código incorrecto. Inténtalo de nuevo.', 'invalid_code', 400)

    @classmethod
    def too_many_attempts(cls):
        return cls('Demasiados intentos fallidos. Solicita un código nuevo.', 'too_many_attempts', 400)

    @classmethod
    def resend_too_soon(cls, seconds):
        return cls(f'Espera {seconds} s para solicitar otro código.', 'resend_too_soon', 429)

    @classmethod
    def email_send_failed(cls):
        return cls(
            'No pudimos enviar el correo con el código. Inténtalo de nuevo en unos minutos.',
            'email_send_failed',
            503,
        )


def first_message(detail):
    """Primer mensaje legible de un detalle de DRF (str, lista o diccionario anidado)."""
    if isinstance(detail, str):
        return str(detail)
    if isinstance(detail, (list, tuple)):
        return first_message(detail[0]) if detail else ''
    if isinstance(detail, dict):
        return first_message(next(iter(detail.values()))) if detail else ''
    return str(detail)


def flora_exception_handler(exc, context):
    response = drf_exception_handler(exc, context)
    if response is None:  # errores 500: los maneja Django
        return None

    if isinstance(exc, APIError):
        response.data = {'code': exc.get_codes(), 'detail': str(exc.detail)}
    elif isinstance(exc, drf.ValidationError):
        response.data = {
            'code': 'validation_error',
            'detail': first_message(exc.detail),
            'errors': response.data,
        }
    elif isinstance(exc, drf.Throttled):
        response.data = {'code': 'throttled', 'detail': 'Demasiadas solicitudes. Inténtalo en unos segundos.'}
    elif isinstance(exc, drf.NotAuthenticated):
        response.data = {'code': 'not_authenticated', 'detail': 'Debes iniciar sesión para continuar.'}
    elif isinstance(exc, drf.AuthenticationFailed):
        response.data = {'code': 'authentication_failed', 'detail': 'La sesión no es válida o expiró.'}
    elif isinstance(exc, (drf.PermissionDenied,)):
        response.data = {'code': 'permission_denied', 'detail': 'No tienes permiso para esta acción.'}
    elif isinstance(exc, Http404):
        response.data = {'code': 'not_found', 'detail': 'Recurso no encontrado.'}
    else:
        raw = getattr(exc, 'detail', None)
        codes = exc.get_codes() if hasattr(exc, 'get_codes') else None
        response.data = {
            'code': codes if isinstance(codes, str) else getattr(exc, 'default_code', 'error'),
            'detail': first_message(raw) if raw is not None else 'No se pudo completar la solicitud.',
        }
    return response
