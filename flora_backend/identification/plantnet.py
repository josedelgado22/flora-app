"""
Cliente HTTP de Pl@ntNet (API v2). SOLO se usa si PLANTNET_API_KEY está definida.

IMPORTANTE: escrito a partir de la documentación conocida de Pl@ntNet (no se pudo consultar al escribirlo).
Cuando su sitio esté disponible, confirma: URL (PLANTNET_API_URL), parámetros api-key / lang / nb-results,
el campo multipart `images` + `organs`, y el formato de respuesta (parsing.py). Todo es ajustable por
variables de entorno o en este archivo, sin tocar la app móvil.
"""
import logging

import requests
from django.conf import settings

from . import errors
from .parsing import parse_response

logger = logging.getLogger(__name__)

CONNECT_TIMEOUT_SECONDS = 1.0


def identify(image_bytes, filename, content_type, organ='auto'):
    """
    @returns lista de resultados crudos (parsing.parse_response); [] si Pl@ntNet no reconoce la planta
    @raises APIError ai_timeout (504) | ai_quota (503) | ai_unavailable (502)
    """
    params = {
        'api-key': settings.PLANTNET_API_KEY,
        'lang': settings.PLANTNET_LANG,
        'nb-results': settings.PLANTNET_MAX_RESULTS,
    }
    try:
        response = requests.post(
            settings.PLANTNET_API_URL,
            params=params,
            files=[('images', (filename, image_bytes, content_type))],
            data={'organs': organ},
            timeout=(CONNECT_TIMEOUT_SECONDS, settings.PLANTNET_TIMEOUT_SECONDS),
        )
    except requests.Timeout:
        raise errors.ai_timeout()
    except requests.RequestException as exc:
        # Solo el tipo de error: el mensaje de requests puede incluir la URL con la clave.
        logger.warning('Pl@ntNet no disponible: %s', type(exc).__name__)
        raise errors.ai_unavailable()

    status = response.status_code
    if status == 404:  # Pl@ntNet responde 404 cuando no encuentra ninguna especie
        return []
    if status == 429:
        logger.warning('Pl@ntNet: límite de uso alcanzado (429).')
        raise errors.ai_quota()
    if status >= 400:
        logger.error('Pl@ntNet respondió %s (revisa la clave y los parámetros).', status)
        raise errors.ai_unavailable()

    try:
        return parse_response(response.json())
    except ValueError:
        logger.error('Pl@ntNet devolvió una respuesta que no es JSON.')
        raise errors.ai_unavailable()
