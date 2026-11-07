"""
POST /sync/batch/  (SC-02: la app envía en lote lo que hizo sin conexión)

Cada operación se procesa en su propia transacción: una operación inválida NO afecta a las demás.
Todas son IDEMPOTENTES (la app reintenta hasta recibir respuesta):
  - planta_nueva: por (usuario, client_local_id)  - riego: por (planta, instante)
"""
import logging

from django.db import transaction
from django.utils import timezone

from accounts.exceptions import first_message

from . import services
from .models import Plant, PlantCategory
from .serializers import FUTURE_TOLERANCE, PlantSerializer, SyncRiegoPayloadSerializer

logger = logging.getLogger(__name__)


class SyncRejected(Exception):
    """Operación rechazada; el mensaje es el `motivo` que recibe la app."""


def _resolve_plant(user, planta_id):
    """Acepta el id del servidor (positivo) o el id local de la app (negativo)."""
    if planta_id < 0:
        plant = Plant.objects.filter(user=user, client_local_id=planta_id).first()
    else:
        plant = Plant.objects.filter(user=user, id=planta_id).first()
    if plant is None:
        raise SyncRejected('planta_no_encontrada')
    return plant


def handle_planta_nueva(user, payload):
    data = {key: value for key, value in payload.items() if value is not None}
    local_id = data.pop('local_id', None)
    data.pop('foto_local_uri', None)  # la foto se sube aparte (Fase 3)

    if local_id is not None:
        try:
            local_id = int(local_id)
        except (TypeError, ValueError):
            raise SyncRejected('payload_invalido: local_id')
        existing = Plant.objects.filter(user=user, client_local_id=local_id).first()
        if existing:  # reintento: devuelve el mismo mapeo
            return {'local_id': local_id, 'server_id': existing.id}
        data['client_local_id'] = local_id

    # Categoría desconocida: se ignora en vez de rechazar toda la planta
    if data.get('categoria') and not PlantCategory.objects.filter(nombre=data['categoria']).exists():
        data.pop('categoria')

    serializer = PlantSerializer(data=data)
    if not serializer.is_valid():
        raise SyncRejected(f'payload_invalido: {first_message(serializer.errors)}')
    plant = serializer.save(user=user)
    return {'local_id': local_id, 'server_id': plant.id} if local_id is not None else None


def handle_riego(user, payload):
    serializer = SyncRiegoPayloadSerializer(data=payload)
    if not serializer.is_valid():
        raise SyncRejected(f'payload_invalido: {first_message(serializer.errors)}')

    regado_en = serializer.validated_data['regado_en']
    if regado_en > timezone.now() + FUTURE_TOLERANCE:
        raise SyncRejected('fecha_futura')

    plant = _resolve_plant(user, serializer.validated_data['planta_id'])
    services.register_watering(plant, regado_en)
    return None


HANDLERS = {'planta_nueva': handle_planta_nueva, 'riego': handle_riego}


def process_batch(user, operations):
    """@returns {procesadas: [client_id], rechazadas: [{client_id, motivo}], mapeo_plantas: [{local_id, server_id}]}"""
    procesadas, rechazadas, mapeo = [], [], []

    # Orden cronológico: una planta creada offline debe existir antes de su primer riego
    for op in sorted(operations, key=lambda item: (item['creado_en'], item['client_id'])):
        handler = HANDLERS.get(op['tipo'])
        if handler is None:
            rechazadas.append({'client_id': op['client_id'], 'motivo': 'tipo_desconocido'})
            continue

        try:
            with transaction.atomic():
                mapping = handler(user, op['payload'])
        except SyncRejected as exc:
            rechazadas.append({'client_id': op['client_id'], 'motivo': str(exc)})
            continue
        except Exception:  # un fallo inesperado no debe tumbar el lote completo
            logger.exception('Error procesando la operación %s (%s)', op['client_id'], op['tipo'])
            rechazadas.append({'client_id': op['client_id'], 'motivo': 'error_interno'})
            continue

        procesadas.append(op['client_id'])
        if mapping:
            mapeo.append(mapping)

    return {'procesadas': procesadas, 'rechazadas': rechazadas, 'mapeo_plantas': mapeo}
