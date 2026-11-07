"""Esquemas de respuesta para la documentación OpenAPI (drf-spectacular). No afecta la lógica."""
from drf_spectacular.utils import OpenApiParameter, inline_serializer
from rest_framework import serializers

from .serializers import PlantSerializer, RiegoSerializer

ESTADOS = ['atrasada', 'hoy', 'ok']

HORIZON_PARAM = OpenApiParameter('dias', int, description='Horizonte en días (1 a 60, por defecto 14).')
PROJECTION_PARAM = OpenApiParameter(
    'proyeccion', bool, description='Con 1 o true, cada ítem incluye la lista `riegos` proyectada al horizonte.'
)

RachaResponse = inline_serializer(
    'RachaResponse',
    {
        'racha_actual': serializers.IntegerField(),
        'mejor_racha': serializers.IntegerField(),
        'ultimo_dia': serializers.DateField(allow_null=True),
        'hecho_hoy': serializers.BooleanField(),
        'en_riesgo': serializers.BooleanField(),
        'mascota_nombre': serializers.CharField(),
    },
)

RiegoProyectado = inline_serializer(
    'RiegoProyectado',
    {
        'fecha': serializers.DateField(),
        'dias_restantes': serializers.IntegerField(),
        'estado': serializers.ChoiceField(choices=ESTADOS),
        'proyectado': serializers.BooleanField(),
    },
    many=True,
    required=False,
)

_AGENDA_ITEM_FIELDS = {
    'planta_id': serializers.IntegerField(),
    'nombre_comun': serializers.CharField(),
    'ubicacion': serializers.CharField(allow_blank=True),
    'nivel_luz': serializers.CharField(allow_blank=True),
    'frecuencia_base_dias': serializers.IntegerField(),
    'factor_evaporacion': serializers.FloatField(),
    'frecuencia_riego_dias': serializers.IntegerField(),
    'ultimo_riego': serializers.DateTimeField(allow_null=True),
    'proximo_riego': serializers.DateField(),
    'dias_restantes': serializers.IntegerField(),
    'estado': serializers.ChoiceField(choices=ESTADOS),
    'riegos': RiegoProyectado,
}

AgendaResponse = inline_serializer(
    'AgendaResponse',
    {
        'fecha': serializers.DateField(),
        'resumen': inline_serializer(
            'AgendaResumen', {'atrasadas': serializers.IntegerField(), 'hoy': serializers.IntegerField()}
        ),
        'items': inline_serializer('AgendaItem', _AGENDA_ITEM_FIELDS, many=True),
    },
)

PlantAgendaResponse = inline_serializer(
    'PlantaAgenda', {'fecha': serializers.DateField(), **_AGENDA_ITEM_FIELDS}
)

RiegoRegistrado = inline_serializer(
    'RiegoRegistrado',
    {'riego': RiegoSerializer(), 'planta': PlantSerializer(), 'racha': RachaResponse},
)

SyncBatchResponse = inline_serializer(
    'SyncBatchResponse',
    {
        'procesadas': serializers.ListField(child=serializers.IntegerField()),
        'rechazadas': inline_serializer(
            'SyncRechazada',
            {'client_id': serializers.IntegerField(), 'motivo': serializers.CharField()},
            many=True,
        ),
        'mapeo_plantas': inline_serializer(
            'SyncMapeoPlanta',
            {'local_id': serializers.IntegerField(), 'server_id': serializers.IntegerField()},
            many=True,
        ),
    },
)
