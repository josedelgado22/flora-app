"""
Modelos de cuentas (3NF).

  cuentas      -> User     (email único, datos personales, estado de verificación)
  codigos_otp  -> OTPCode  (N códigos por cuenta; solo guarda la FK, nada duplicado del usuario)
"""
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError('El correo es obligatorio.')
        email = self.normalize_email(email).strip().lower()
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        return self._create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """Cuenta de F.L.O.R.A. Se crea inactiva al registrarse y se activa al verificar el correo."""

    email = models.EmailField(max_length=254, unique=True)
    nombre = models.CharField(max_length=100)
    apellido = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    two_factor_enabled = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['nombre', 'apellido']

    class Meta:
        db_table = 'cuentas'
        verbose_name = 'cuenta'
        verbose_name_plural = 'cuentas'

    def __str__(self):
        return self.email


class OTPCode(models.Model):
    """
    Desafío OTP de un solo uso. Cada fila es un "challenge" (challenge_id público).

    - code: resumen HMAC-SHA256 del código (nunca el código en claro).
    - created_at: momento de la última emisión; se renueva al reenviar el código.
    - is_used: se marca al verificar con éxito (un solo uso) o al reemplazarlo por uno nuevo.
    - attempts: intentos fallidos; al llegar a OTP_MAX_ATTEMPTS se bloquea hasta reenviar.
    """

    class Purpose(models.TextChoices):
        REGISTER = 'register', 'Registro'
        LOGIN = 'login', 'Inicio de sesión'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='otp_codes')
    challenge_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    purpose = models.CharField(max_length=10, choices=Purpose.choices)
    code = models.CharField(max_length=64)
    created_at = models.DateTimeField(default=timezone.now)
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = 'codigos_otp'
        indexes = [models.Index(fields=['user', 'purpose', 'is_used'], name='idx_otp_user_purpose_used')]

    def __str__(self):
        return f'{self.purpose} · {self.user_id} · {self.challenge_id}'

    @property
    def expires_at(self):
        return self.created_at + timedelta(seconds=settings.OTP_EXPIRY_SECONDS)

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at
