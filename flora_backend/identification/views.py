"""
identification/views.py - Proxy Seguro e Inspección Binaria de Fotografía (HU-FLOR-009).
Alineado con Rúbrica Duoc UC: IE 3 (OpenAPI 3.0), IE 6 (QA), IE 7 (OWASP M7) e IE 8 (ISO/IEC 25010).
"""
from drf_spectacular.utils import extend_schema, OpenApiTypes, inline_serializer
from rest_framework import serializers
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import services
from .serializers import IdentifyRequestSerializer


class IdentifyView(APIView):
    """
    POST /api/v1/identificacion/ (multipart: imagen, organ?) -> { resultados[], fuente, tiempo_ms }
    Requiere token JWT. Aplica límite de peticiones (scope 'identify') para proteger la cuota de Pl@ntNet.
    """

    parser_classes = [MultiPartParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'identify'

    @extend_schema(
        summary="Identificación botánica por IA con Circuit Breaker (HU-FLOR-009)",
        description=(
            "Recibe una imagen vía multipart/form-data. Realiza inspección de Magic Bytes en el servidor "
            "(OWASP M7), aplica Throttling y consulta la API de Pl@ntNet v2 con un timeout de 3.0s. "
            "Si el servicio externo falla o se agota la cuota, conmuta automáticamente hacia el "
            "adaptador sintético local sin interrumpir la operación."
        ),
        request=IdentifyRequestSerializer,
        responses={
            200: inline_serializer(
                'IdentifyResultResponse',
                fields={
                    'resultados': serializers.ListField(
                        child=serializers.DictField(),
                        help_text="Listado de coincidencias botánicas ordenadas por score"
                    ),
                    'fuente': serializers.CharField(
                        help_text="Proveedor que resolvió la petición ('plantnet_v2' o 'simulated_fallback')"
                    ),
                    'tiempo_ms': serializers.IntegerField(
                        help_text="Tiempo total de procesamiento en milisegundos (SLA < 3000 ms)"
                    )
                }
            ),
            400: OpenApiTypes.OBJECT,
            401: OpenApiTypes.OBJECT,
            429: OpenApiTypes.OBJECT,
        }
    )
    def post(self, request):
        serializer = IdentifyRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        upload = serializer.validated_data['imagen']
        image_bytes, content_type = services.validate_upload(upload)
        result = services.identify_image(
            image_bytes,
            upload.name or 'planta.jpg',
            content_type,  # Detectado mediante la firma binaria de bytes, no por el cliente
            serializer.validated_data['organ'],
        )
        return Response(result)