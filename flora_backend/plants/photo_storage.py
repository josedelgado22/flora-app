"""
Almacenamiento de fotos de plantas en Supabase Storage (HU-FLOR-014).

Mantiene la misma firma que usa plants/views.py:
    save_photo(plant, file) -> str   (URL pública absoluta)

Django valida la imagen y la sube con la clave de servicio (que nunca llega a la app);
en la base solo queda la URL pública en fotos_planta.url.

Variables de entorno (settings.py): SUPABASE_URL, SUPABASE_SERVICE_KEY,
SUPABASE_BUCKET, SUPABASE_TIMEOUT.
"""
import logging
import urllib.error
import urllib.parse
import urllib.request
import uuid

from django.conf import settings
from rest_framework.exceptions import APIException, ValidationError

logger = logging.getLogger(__name__)


class StorageUnavailable(APIException):
    status_code = 503
    default_detail = 'No pudimos guardar la foto. Inténtalo de nuevo en unos minutos.'
    default_code = 'storage_unavailable'


def _configured():
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


def _headers(extra=None):
    key = settings.SUPABASE_SERVICE_KEY
    headers = {'apikey': key}
    if key.startswith('eyJ'):  # clave JWT clásica (service_role)
        headers['Authorization'] = f'Bearer {key}'
    headers.update(extra or {})
    return headers


def _object_url(path):
    return f'{settings.SUPABASE_URL}/storage/v1/object/{settings.SUPABASE_BUCKET}/{urllib.parse.quote(path)}'


def _public_prefix():
    return f'{settings.SUPABASE_URL}/storage/v1/object/public/{settings.SUPABASE_BUCKET}/'


def detect_image_type(head):
    """Reconoce JPEG, PNG o WebP por su firma (no confía en el nombre ni en el Content-Type del cliente)."""
    if head.startswith(b'\xff\xd8\xff'):
        return 'jpg', 'image/jpeg'
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png', 'image/png'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'webp', 'image/webp'
    return None


def upload_object(path, content, mime):
    if not _configured():
        logger.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY: no se puede guardar la foto.')
        raise StorageUnavailable()

    request = urllib.request.Request(
        _object_url(path),
        data=content,
        method='POST',
        headers=_headers({'Content-Type': mime, 'x-upsert': 'false'}),
    )
    try:
        with urllib.request.urlopen(request, timeout=settings.SUPABASE_TIMEOUT):
            pass
    except urllib.error.HTTPError as exc:
        logger.error('Supabase Storage respondió %s: %s', exc.code, exc.read().decode('utf-8', 'replace')[:300])
        raise StorageUnavailable()
    except (urllib.error.URLError, TimeoutError):
        logger.exception('No se pudo contactar a Supabase Storage.')
        raise StorageUnavailable()

    return f'{_public_prefix()}{path}'


def delete_object(path):
    """Borrado de mejor esfuerzo: nunca lanza, solo registra."""
    if not _configured():
        return
    request = urllib.request.Request(_object_url(path), method='DELETE', headers=_headers())
    try:
        with urllib.request.urlopen(request, timeout=settings.SUPABASE_TIMEOUT):
            pass
    except Exception:
        logger.warning('No se pudo borrar %s de Supabase Storage.', path, exc_info=True)


def delete_photo_by_url(url):
    prefix = _public_prefix()
    if url and url.startswith(prefix):
        delete_object(url[len(prefix):])


def save_photo(plant, file):
    """Sube la foto a Supabase y devuelve su URL pública absoluta."""
    file.seek(0)
    content = file.read()

    kind = detect_image_type(content[:16])
    if kind is None:
        raise ValidationError({'imagen': ['Formato no válido. Usa JPEG, PNG o WebP.']})
    ext, mime = kind

    path = f'{plant.user_id}/{plant.pk}/{uuid.uuid4().hex}.{ext}'
    return upload_object(path, content, mime)