"""Configuración para pytest: SQLite en memoria, hash rápido, correo en memoria."""
import os

os.environ.setdefault('DEBUG', 'True')
os.environ.setdefault('SECRET_KEY', 'test-secret-key-only-for-pytest-0123456789abcdef')

from .settings import *  # noqa: E402,F401,F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']  # solo tests: acelera
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
REST_FRAMEWORK = {**REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': {'auth': '1000/min', 'identify': '1000/min'}}  # noqa: F405

# Valores explícitos para que los tests no dependan del entorno
TWO_FACTOR_REQUIRED = True
OTP_EXPIRY_SECONDS = 300
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 30

# Identificación: en tests NUNCA se llama a Pl@ntNet de verdad
PLANTNET_API_KEY = ''
PLANTNET_API_URL = 'https://plantnet.invalid/v2/identify/all'
PLANTNET_LANG = 'es'
PLANTNET_MAX_RESULTS = 3
PLANTNET_TIMEOUT_SECONDS = 2.2
IDENTIFICATION_MODE = 'auto'
IDENTIFICATION_MAX_IMAGE_BYTES = 1_000_000
