"""Vistas delgadas: validan la entrada, delegan en services.py y responden."""
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import services
from .models import OTPCode
from .schema import (
    ChallengeResponse,
    ErrorResponse,
    ExpiresResponse,
    HealthResponse,
    LoginResponse,
    TokensResponse,
)
from .serializers import (
    ChallengeSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
    VerifyCodeSerializer,
)

Purpose = OTPCode.Purpose


class AuthPublicView(APIView):
    """Base de los endpoints públicos: sin JWT y con límite de peticiones por IP (scope 'auth')."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'


class RegisterView(AuthPublicView):
    """POST /auth/register/ -> 202 { requires_verification, challenge_id, method, email_hint, expires_in }"""

    @extend_schema(
        tags=['Autenticación'],
        request=RegisterSerializer,
        responses={202: ChallengeResponse, 400: ErrorResponse, 409: ErrorResponse, 429: ErrorResponse, 503: ErrorResponse},
        description='Crea la cuenta (pendiente) y envía un código de 6 dígitos por correo. Se activa en /auth/register/verify/.',
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(services.register_user(**serializer.validated_data), status=status.HTTP_202_ACCEPTED)


class RegisterVerifyView(AuthPublicView):
    """POST /auth/register/verify/ -> 200 { access, refresh, user }"""

    @extend_schema(
        tags=['Autenticación'],
        request=VerifyCodeSerializer,
        responses={200: TokensResponse, 400: ErrorResponse, 429: ErrorResponse},
        description='Confirma el código del registro, activa la cuenta y devuelve los tokens JWT.',
    )
    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = services.activate_account(**serializer.validated_data)
        return Response(data, status=status.HTTP_200_OK)


class RegisterResendView(AuthPublicView):
    """POST /auth/register/resend/ -> 200 { expires_in }"""

    @extend_schema(
        tags=['Autenticación'],
        request=ChallengeSerializer,
        responses={200: ExpiresResponse, 400: ErrorResponse, 429: ErrorResponse, 503: ErrorResponse},
        description='Reenvía el código del registro (con tiempo de espera entre envíos).',
    )
    def post(self, request):
        serializer = ChallengeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = services.resend_code(serializer.validated_data['challenge_id'], Purpose.REGISTER)
        return Response(data, status=status.HTTP_200_OK)


class LoginView(AuthPublicView):
    """POST /auth/login/ -> 200 { access, refresh, user } | { requires_2fa, challenge_id, ... }"""

    @extend_schema(
        tags=['Autenticación'],
        request=LoginSerializer,
        responses={200: LoginResponse, 400: ErrorResponse, 401: ErrorResponse, 429: ErrorResponse, 503: ErrorResponse},
        description='Con doble factor activo responde `requires_2fa` y un `challenge_id`; si no, entrega los tokens JWT.',
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(services.login_user(**serializer.validated_data), status=status.HTTP_200_OK)


class TwoFactorVerifyView(AuthPublicView):
    """POST /auth/2fa/verify/ -> 200 { access, refresh, user }"""

    @extend_schema(
        tags=['Autenticación'],
        request=VerifyCodeSerializer,
        responses={200: TokensResponse, 400: ErrorResponse, 429: ErrorResponse},
        description='Confirma el código de 6 dígitos del doble factor (OTP firmado con HMAC-SHA256, 300 s) y devuelve los tokens.',
    )
    def post(self, request):
        serializer = VerifyCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = services.complete_two_factor(**serializer.validated_data)
        return Response(data, status=status.HTTP_200_OK)


class TwoFactorResendView(AuthPublicView):
    """POST /auth/2fa/resend/ -> 200 { expires_in }"""

    @extend_schema(
        tags=['Autenticación'],
        request=ChallengeSerializer,
        responses={200: ExpiresResponse, 400: ErrorResponse, 429: ErrorResponse, 503: ErrorResponse},
        description='Reenvía el código del doble factor.',
    )
    def post(self, request):
        serializer = ChallengeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = services.resend_code(serializer.validated_data['challenge_id'], Purpose.LOGIN)
        return Response(data, status=status.HTTP_200_OK)


class MeView(APIView):
    """GET /auth/me/ -> datos del usuario autenticado (requiere Bearer token)."""

    @extend_schema(tags=['Autenticación'], responses={200: UserSerializer, 401: ErrorResponse})
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class HealthView(APIView):
    """GET /health/ -> usado por el health check de Render."""

    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = []

    @extend_schema(tags=['Sistema'], responses=HealthResponse, description='Chequeo de salud (sin autenticación).')
    def get(self, request):
        return Response({'status': 'ok'})
