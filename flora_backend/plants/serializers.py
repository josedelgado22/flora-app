"""Validación de entrada y representación de salida (el formato calza con la app móvil)."""
from datetime import timedelta

from rest_framework import serializers

from django.utils import timezone

from .models import FotoPlanta, Plant, PlantCategory, Racha, Riego

FUTURE_TOLERANCE = timedelta(minutes=5)  # margen por relojes desfasados entre teléfono y servidor


def ensure_not_future(value):
    """Un riego no puede ser del futuro (evita inflar la racha)."""
    if value > timezone.now() + FUTURE_TOLERANCE:
        raise serializers.ValidationError('La fecha del riego no puede estar en el futuro.')
    return value


class PlantSerializer(serializers.ModelSerializer):
    categoria = serializers.SlugRelatedField(
        slug_field='nombre', queryset=PlantCategory.objects.all(), required=False, allow_null=True
    )
    # Frecuencia EFECTIVA (ajustada a la luz). La base se envía/recibe en `frecuencia_base_dias`.
    frecuencia_riego_dias = serializers.IntegerField(source='frecuencia_ajustada_dias', read_only=True)
    foto_url = serializers.SerializerMethodField()

    class Meta:
        model = Plant
        fields = (
            'id',
            'nombre_comun',
            'nombre_cientifico',
            'categoria',
            'especie_slug',
            'nivel_luz',
            'ubicacion',
            'frecuencia_base_dias',
            'frecuencia_riego_dias',
            'ultimo_riego',
            'foto_url',
            'client_local_id',
            'creado_en',
        )
        read_only_fields = ('id', 'ultimo_riego', 'creado_en')
        extra_kwargs = {'client_local_id': {'write_only': True, 'required': False}}

    def get_foto_url(self, obj) -> str | None:
        photos = [foto for foto in obj.fotos.all() if foto.tipo == FotoPlanta.Tipo.PLANTA]
        return max(photos, key=lambda foto: foto.tomada_en).url if photos else None


class RiegoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Riego
        fields = ('id', 'regado_en')
        read_only_fields = fields


class RiegoCreateSerializer(serializers.Serializer):
    regado_en = serializers.DateTimeField(required=False, validators=[ensure_not_future])

    def validate(self, attrs):
        attrs.setdefault('regado_en', timezone.now())
        return attrs


class MascotaSerializer(serializers.Serializer):
    mascota_nombre = serializers.CharField(min_length=2, max_length=20)


class RachaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Racha
        fields = ('racha_actual', 'mejor_racha', 'ultimo_dia', 'mascota_nombre')


# ---- Sincronización por lotes ----
SYNC_MAX_BATCH = 200


class SyncOperationSerializer(serializers.Serializer):
    client_id = serializers.IntegerField()
    tipo = serializers.CharField(max_length=30)
    payload = serializers.DictField()
    creado_en = serializers.DateTimeField()


class SyncBatchSerializer(serializers.Serializer):
    operaciones = SyncOperationSerializer(many=True, allow_empty=True, max_length=SYNC_MAX_BATCH)


class SyncRiegoPayloadSerializer(serializers.Serializer):
    planta_id = serializers.IntegerField()  # id del servidor (positivo) o id local de la app (negativo)
    regado_en = serializers.DateTimeField()
class FotoSerializer(serializers.ModelSerializer):
    class Meta:
        model = FotoPlanta
        fields = ('id', 'tipo', 'url', 'tomada_en')
        read_only_fields = fields


class FotoUploadSerializer(serializers.Serializer):
    imagen = serializers.FileField()
    tipo = serializers.ChoiceField(choices=FotoPlanta.Tipo.choices, default=FotoPlanta.Tipo.PLANTA)