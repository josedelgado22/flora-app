"""
identification/services.py - Pipeline de Ingesta Botánica e Identificación por IA (HU-FLOR-009 / HU-FLOR-010)
Alineado con IE 3 (OpenAPI 3.0), IE 6 (QA), IE 7 (OWASP M7) e IE 8 (SLA ISO/IEC 25010).
"""
import logging
import time
from django.conf import settings
from plants.utils import validar_luminosidad_imagen  # Importación del módulo de luminosidad
from . import errors, plantnet
from .catalog import build_candidates
from .imaging import sniff_image
from .simulated import simulated_results

logger = logging.getLogger(__name__)

SLA_MS = 3000  # HU-FLOR-009: SLA estricto de identificación en menos de 3.0 segundos


def is_real_mode():
    return bool(settings.PLANTNET_API_KEY) and settings.IDENTIFICATION_MODE != 'simulated'


def validate_upload(upload):
    """
    Valida tamaño, firma binaria (Magic Bytes) y luminancia de la imagen (HU-FLOR-010 / OWASP M7).
    @returns (bytes, content_type real). Lanza APIError 413 / 400.
    """
    # 1. Validación de tamaño máximo permitido
    if upload.size > settings.IDENTIFICATION_MAX_IMAGE_BYTES:
        raise errors.image_too_large()

    # 2. Validación server-side de luminancia percebida (HU-FLOR-010: 40 <= L <= 240)
    validar_luminosidad_imagen(upload)

    # 3. Lectura de bytes e inspección de firma binaria (Sniffing)
    data = upload.read()
    content_type = sniff_image(data)
    if content_type is None:
        raise errors.invalid_image()

    return data, content_type


def identify_image(image_bytes, filename, content_type, organ='auto'):
    """
    Orquesta la identificación: Pl@ntNet v2 (modo real con API Key) o catálogo sintético (modo simulado).
    Calcula la latencia consumida y audita el cumplimiento del SLA de 3000 ms (ISO/IEC 25010).
    """
    started = time.monotonic()
    real = is_real_mode()

    # Conmutación atómica entre servicio externo y simulador local (Circuit Breaker)
    raw = plantnet.identify(image_bytes, filename, content_type, organ) if real else simulated_results(image_bytes)
    candidates = build_candidates(raw, limit=settings.PLANTNET_MAX_RESULTS)

    elapsed_ms = int((time.monotonic() - started) * 1000)
    
    # Monitoreo de SLA en logs
    if elapsed_ms > SLA_MS:
        logger.warning('Identificación lenta: %s ms (SLA %s ms).', elapsed_ms, SLA_MS)

    return {
        'resultados': candidates,
        'fuente': 'plantnet' if real else 'simulado',
        'tiempo_ms': elapsed_ms,
    }

