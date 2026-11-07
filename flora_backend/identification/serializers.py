"""
identification/serializers.py - Serializador de Peticiones de Identificación Botánica (HU-FLOR-009 / HU-FLOR-010)
Alineado con los estándares OpenAPI 3.0 (drf-spectacular) y la validación de entradas OWASP Mobile M7.
"""
from rest_framework import serializers

# Definición formal de órganos vegetales soportados por la API de Pl@ntNet v2
ORGANS = ['auto', 'leaf', 'flower', 'fruit', 'bark']


class IdentifyRequestSerializer(serializers.Serializer):
    """
    Valida el payload multipart/form-data recibido desde la aplicación móvil.
    """
    imagen = serializers.FileField(
        allow_empty_file=False,
        max_length=255,
        help_text="Fotografía de la planta en formato JPEG o PNG (Máx. 10 MB, Luminancia 40-240)."
    )
    organ = serializers.ChoiceField(
        choices=ORGANS,
        default='auto',
        required=False,
        help_text="Órgano vegetal capturado para guiar el modelo de visión artificial ('auto', 'leaf', 'flower', 'fruit', 'bark')."
    )