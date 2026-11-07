"""Vistas delgadas del jardín: plantas, riegos, rachas, agenda y sincronización (todas con JWT)."""
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from django.utils import timezone

from . import services, sync
from .models import Plant
from .schema import (
    HORIZON_PARAM,
    PROJECTION_PARAM,
    AgendaResponse,
    PlantAgendaResponse,
    RachaResponse,
    RiegoRegistrado,
    SyncBatchResponse,
)
from .serializers import (
    MascotaSerializer,
    PlantSerializer,
    RiegoCreateSerializer,
    RiegoSerializer,
    SyncBatchSerializer,
)


def parse_horizon(request):
    """Lee ?dias= (1 a 60, por defecto 14) y lo valida."""
    try:
        horizon = int(request.query_params.get('dias', 14))
    except ValueError:
        raise ValidationError({'dias': ['Debe ser un número entero.']})
    if not 1 <= horizon <= 60:
        raise ValidationError({'dias': ['Debe estar entre 1 y 60.']})
    return horizon


class PlantViewSet(viewsets.ModelViewSet):
    """CRUD de plantas del usuario autenticado. Las de otros usuarios responden 404."""

    serializer_class = PlantSerializer
    pagination_class = None  # la app espera una lista simple

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):  # generación del esquema OpenAPI: sin usuario real
            return Plant.objects.none()
        return Plant.objects.filter(user=self.request.user).select_related('categoria').prefetch_related('fotos')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        local_id = serializer.validated_data.get('client_local_id')
        if local_id is not None:  # reintento de una creación offline: devuelve la misma planta
            existing = Plant.objects.filter(user=request.user, client_local_id=local_id).first()
            if existing:
                return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(methods=['GET'], responses=RiegoSerializer(many=True), description='Historial (últimos 100 riegos).')
    @extend_schema(
        methods=['POST'],
        request=RiegoCreateSerializer,
        responses={200: RiegoRegistrado, 201: RiegoRegistrado},
        description='Registra un riego. Idempotente por instante: repetirlo responde 200 sin duplicar ni sumar racha.',
    )
    @action(detail=True, methods=['get', 'post'], url_path='riegos')
    def riegos(self, request, pk=None):
        """GET historial · POST registra un riego (idempotente por instante)."""
        plant = self.get_object()

        if request.method == 'GET':
            return Response(RiegoSerializer(plant.riegos.all()[:100], many=True).data)

        serializer = RiegoCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        riego, created = services.register_watering(plant, serializer.validated_data['regado_en'])
        plant.refresh_from_db()

        body = {
            'riego': RiegoSerializer(riego).data,
            'planta': PlantSerializer(plant).data,
            'racha': services.racha_payload(services.get_or_create_racha(request.user)),
        }
        return Response(body, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @extend_schema(
        parameters=[HORIZON_PARAM],
        responses=PlantAgendaResponse,
        description='Próximo riego de la planta y los siguientes proyectados dentro del horizonte (HU-008).',
    )
    @action(detail=True, methods=['get'], url_path='agenda')
    def agenda(self, request, pk=None):
        """GET /plantas/<id>/agenda/?dias=14 · riegos proyectados de una planta (HU-008)."""
        plant = self.get_object()  # filtra por usuario: una planta ajena responde 404
        today = timezone.localdate()
        horizon = parse_horizon(request)
        return Response({'fecha': today, **services.agenda_projection(plant, today, horizon)})


class RachaMeView(APIView):
    """GET racha y mascota del usuario · PATCH {mascota_nombre} renombra a Espina."""

    @extend_schema(responses=RachaResponse, description='Racha vigente y nombre de la mascota (HU-004).')
    def get(self, request):
        return Response(services.racha_payload(services.get_or_create_racha(request.user)))

    @extend_schema(request=MascotaSerializer, responses=RachaResponse, description='Renombra a la mascota.')
    def patch(self, request):
        serializer = MascotaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        racha = services.get_or_create_racha(request.user)
        racha.mascota_nombre = serializer.validated_data['mascota_nombre']
        racha.save(update_fields=['mascota_nombre'])
        return Response(services.racha_payload(racha))


class AgendaView(APIView):
    """GET /agenda/?dias=14[&proyeccion=1] · próximos riegos con la frecuencia ajustada a la luz (HU-008)."""

    @extend_schema(
        parameters=[HORIZON_PARAM, PROJECTION_PARAM],
        responses=AgendaResponse,
        description='Agenda de riego del usuario, con la frecuencia ajustada a la luz y la evaporación.',
    )
    def get(self, request):
        horizon = parse_horizon(request)
        with_projection = request.query_params.get('proyeccion') in ('1', 'true')

        today = timezone.localdate()
        plants = Plant.objects.filter(user=request.user)
        items = [
            services.agenda_projection(plant, today, horizon) if with_projection
            else services.agenda_item(plant, today)
            for plant in plants
        ]
        items = sorted(
            (item for item in items if item['dias_restantes'] <= horizon),
            key=lambda item: (item['dias_restantes'], item['nombre_comun']),
        )

        return Response(
            {
                'fecha': today,
                'resumen': {
                    'atrasadas': sum(1 for item in items if item['estado'] == 'atrasada'),
                    'hoy': sum(1 for item in items if item['estado'] == 'hoy'),
                },
                'items': items,
            }
        )


class SyncBatchView(APIView):
    """POST /sync/batch/ · cola offline de la app (planta_nueva, riego)."""

    @extend_schema(
        request=SyncBatchSerializer,
        responses=SyncBatchResponse,
        description='Procesa en lote lo hecho sin conexión (SC-02). Cada operación es idempotente e independiente.',
    )
    def post(self, request):
        serializer = SyncBatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(sync.process_batch(request.user, serializer.validated_data['operaciones']))
