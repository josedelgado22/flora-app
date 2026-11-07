"""POST /diagnostico/ y GET /diagnostico/sintomas/ (HU-FLOR-012). Vistas delgadas; las reglas viven en diagnosis.py."""
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from django.utils import timezone

from . import services
from .diagnosis import SYMPTOM_IDS, SYMPTOMS, extra_advice, get_symptom
from .models import Plant


class DiagnosisRequestSerializer(serializers.Serializer):
    sintoma_id = serializers.ChoiceField(choices=SYMPTOM_IDS)
    planta_id = serializers.IntegerField(required=False, help_text='Id de la planta (opcional): afina la recomendación.')


DiagnosticoResponse = inline_serializer(
    'Diagnostico',
    {
        'sintoma_id': serializers.CharField(),
        'titulo': serializers.CharField(),
        'causa': serializers.CharField(),
        'solucion': serializers.CharField(),
        'tipo': serializers.CharField(),
        'recomendaciones_adicionales': serializers.ListField(child=serializers.CharField()),
    },
)


def _public(symptom):
    return {
        'sintoma_id': symptom['id'],
        'titulo': symptom['titulo'],
        'causa': symptom['causa'],
        'solucion': symptom['solucion'],
        'tipo': symptom['tipo'],
    }


class SymptomListView(APIView):
    """GET /diagnostico/sintomas/ · catálogo de síntomas."""

    @extend_schema(tags=['Diagnóstico'], responses=inline_serializer('SintomaItem', {
        'sintoma_id': serializers.CharField(), 'titulo': serializers.CharField(),
        'causa': serializers.CharField(), 'solucion': serializers.CharField(), 'tipo': serializers.CharField(),
    }, many=True))
    def get(self, request):
        return Response([_public(symptom) for symptom in SYMPTOMS])


class DiagnosisView(APIView):
    """POST /diagnostico/ {sintoma_id, planta_id?} · causa y recomendación (con ajuste según la planta)."""

    @extend_schema(
        tags=['Diagnóstico'],
        request=DiagnosisRequestSerializer,
        responses={200: DiagnosticoResponse},
        description='Causa y recomendación del síntoma; con `planta_id` se ajusta a la planta (404 si es ajena o no existe).',
    )
    def post(self, request):
        serializer = DiagnosisRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        symptom = get_symptom(serializer.validated_data['sintoma_id'])
        advice = []

        plant_id = serializer.validated_data.get('planta_id')
        if plant_id is not None:
            plant = Plant.objects.select_related('categoria').filter(user=request.user, id=plant_id).first()
            if plant is None:  # inexistente o de otro usuario: misma respuesta
                raise NotFound('Planta no encontrada.')
            item = services.agenda_item(plant, timezone.localdate())
            advice = extra_advice(
                symptom['id'],
                categoria=plant.categoria.nombre if plant.categoria else None,
                nivel_luz=plant.nivel_luz,
                ubicacion=plant.ubicacion,
                dias_restantes=item['dias_restantes'],
            )

        return Response({**_public(symptom), 'recomendaciones_adicionales': advice})
