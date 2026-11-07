"""Esquemas de respuesta de la API de autenticación para OpenAPI (drf-spectacular). No afecta la lógica."""
from drf_spectacular.utils import inline_serializer
from rest_framework import serializers

from .serializers import UserSerializer

# Formato de error que devuelve flora_exception_handler (la app lee `code` y `detail`)
ErrorResponse = inline_serializer(
    'ErrorResponse',
    {'code': serializers.CharField(), 'detail': serializers.CharField()},
)

# Registro / reenvío de código: el desafío que se confirma con el código de 6 dígitos
ChallengeResponse = inline_serializer(
    'AuthChallenge',
    {
        'requires_verification': serializers.BooleanField(required=False),
        'requires_2fa': serializers.BooleanField(required=False),
        'challenge_id': serializers.CharField(),
        'method': serializers.CharField(),
        'email_hint': serializers.CharField(),
        'expires_in': serializers.IntegerField(help_text='Segundos de validez del código.'),
    },
)

TokensResponse = inline_serializer(
    'AuthTokens',
    {'access': serializers.CharField(), 'refresh': serializers.CharField(), 'user': UserSerializer()},
)

# Login: devuelve los tokens, o un desafío 2FA si el doble factor está activo
LoginResponse = inline_serializer(
    'LoginResponse',
    {
        'access': serializers.CharField(required=False),
        'refresh': serializers.CharField(required=False),
        'user': UserSerializer(required=False),
        'requires_2fa': serializers.BooleanField(required=False),
        'challenge_id': serializers.CharField(required=False),
        'method': serializers.CharField(required=False),
        'email_hint': serializers.CharField(required=False),
        'expires_in': serializers.IntegerField(required=False),
    },
)

ExpiresResponse = inline_serializer('AuthExpiresIn', {'expires_in': serializers.IntegerField()})

HealthResponse = inline_serializer('Health', {'status': serializers.CharField()})
