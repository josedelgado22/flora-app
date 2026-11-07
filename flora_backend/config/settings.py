"""
Configuración de F.L.O.R.A. (Django REST Framework).

- Local: SQLite (sin configurar nada) + correo por consola.
- Producción (Render): PostgreSQL vía DATABASE_URL + SMTP vía variables de entorno.
Todo lo sensible se lee de variables de entorno (ver .env.example).
"""
import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - python-dotenv es opcional
    load_dotenv = None

BASE_DIR = Path(__file__).resolve().parent.parent

if load_dotenv:
    load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


def env_int(name, default):
    return int(os.getenv(name, default))


def env_list(name, default=''):
    return [item.strip() for item in os.getenv(name, default).split(',') if item.strip()]


# ---------------------------------------------------------------------------
# Seguridad básica
# ---------------------------------------------------------------------------
DEBUG = env_bool('DEBUG', False)

SECRET_KEY = os.getenv('SECRET_KEY', '')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'dev-only-insecure-key-do-not-use-in-production-0123456789abcdef'
    else:
        raise ImproperlyConfigured('Define la variable de entorno SECRET_KEY.')

ALLOWED_HOSTS = env_list('ALLOWED_HOSTS', 'localhost,127.0.0.1,10.0.2.2')
RENDER_EXTERNAL_HOSTNAME = os.getenv('RENDER_EXTERNAL_HOSTNAME')  # lo define Render
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

CSRF_TRUSTED_ORIGINS = env_list('CSRF_TRUSTED_ORIGINS')
if RENDER_EXTERNAL_HOSTNAME:
    CSRF_TRUSTED_ORIGINS.append(f'https://{RENDER_EXTERNAL_HOSTNAME}')

# ---------------------------------------------------------------------------
# Aplicaciones y middleware
# ---------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'drf_spectacular',
    'accounts',
    'plants',
    'identification',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ---------------------------------------------------------------------------
# Base de datos: PostgreSQL en producción (DATABASE_URL), SQLite en local
# ---------------------------------------------------------------------------
_database_url = os.getenv('DATABASE_URL', '')

if _database_url:
    # Producción (Render + Supabase) o cualquier PostgreSQL local
    _is_postgres = _database_url.startswith(('postgres://', 'postgresql://'))
    DATABASES = {
        'default': dj_database_url.parse(
            _database_url,
            conn_max_age=env_int('DB_CONN_MAX_AGE', 600),
            conn_health_checks=True,
            # SSL obligatorio en producción para PostgreSQL (Supabase lo exige)
            ssl_require=env_bool('DB_SSL_REQUIRE', _is_postgres and not DEBUG),
            # Necesario con el pooler de Supabase en modo "transaction" (puerto 6543)
            disable_server_side_cursors=env_bool('DB_DISABLE_SERVER_SIDE_CURSORS', False),
        )
    }
else:
    # Desarrollo local: SQLite sin configurar nada
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ---------------------------------------------------------------------------
# Usuarios y contraseñas
# ---------------------------------------------------------------------------
AUTH_USER_MODEL = 'accounts.User'

# La regla de contraseña (8+ caracteres, letra y número) vive en accounts/serializers.py
# y coincide con la validación de la app móvil.
AUTH_PASSWORD_VALIDATORS = []

# ---------------------------------------------------------------------------
# Django REST Framework + JWT (HS256 / HMAC-SHA256)
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],  # seguro por defecto
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',  # fase 2: foto para identificación IA
    ],
    'EXCEPTION_HANDLER': 'accounts.exceptions.flora_exception_handler',
    'DEFAULT_THROTTLE_RATES': {
        'auth': os.getenv('AUTH_THROTTLE_RATE', '30/min'),
        'identify': os.getenv('IDENTIFY_THROTTLE_RATE', '20/min'),  # protege la cuota de Pl@ntNet
    },
    'NUM_PROXIES': int(os.environ['NUM_PROXIES']) if os.getenv('NUM_PROXIES') else None,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=env_int('JWT_ACCESS_MINUTES', 30)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=env_int('JWT_REFRESH_DAYS', 7)),
    'ALGORITHM': 'HS256',
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ---------------------------------------------------------------------------
# OTP / doble factor
# ---------------------------------------------------------------------------
TWO_FACTOR_REQUIRED = env_bool('TWO_FACTOR_REQUIRED', True)
OTP_EXPIRY_SECONDS = env_int('OTP_EXPIRY_SECONDS', 300)  # 5 minutos
OTP_MAX_ATTEMPTS = env_int('OTP_MAX_ATTEMPTS', 5)
OTP_RESEND_COOLDOWN_SECONDS = env_int('OTP_RESEND_COOLDOWN_SECONDS', 30)

# ---------------------------------------------------------------------------
# Correo (Gmail / Resend / Brevo por SMTP)
# ---------------------------------------------------------------------------
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = env_int('EMAIL_PORT', 587)
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_SSL = env_bool('EMAIL_USE_SSL', False)  # puerto 465
EMAIL_USE_TLS = env_bool('EMAIL_USE_TLS', not EMAIL_USE_SSL)  # puerto 587
EMAIL_TIMEOUT = env_int('EMAIL_TIMEOUT', 10)
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL') or EMAIL_HOST_USER or 'F.L.O.R.A. <no-reply@flora.local>'
BREVO_API_KEY = os.getenv('BREVO_API_KEY', '')
# Sin credenciales SMTP el correo se imprime en consola/logs (el código OTP queda visible
# ahí: útil para desarrollar y para demos; configura SMTP real antes de producción).
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND') or (
    'django.core.mail.backends.smtp.EmailBackend'
    if EMAIL_HOST_USER
    else 'django.core.mail.backends.console.EmailBackend'
)

# ---------------------------------------------------------------------------
# CORS (la app móvil no lo necesita; solo pruebas desde navegador)
# ---------------------------------------------------------------------------
CORS_ALLOWED_ORIGINS = env_list('CORS_ALLOWED_ORIGINS')
CORS_ALLOW_ALL_ORIGINS = env_bool('CORS_ALLOW_ALL_ORIGINS', DEBUG)

# ---------------------------------------------------------------------------
# Internacionalización, estáticos y seguridad en producción
# ---------------------------------------------------------------------------
LANGUAGE_CODE = 'es-cl'
TIME_ZONE = 'America/Santiago'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
}

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')  # Render termina TLS en su proxy
    SECURE_SSL_REDIRECT = env_bool('SECURE_SSL_REDIRECT', True)
    SECURE_REDIRECT_EXEMPT = [r'^api/v1/health/$']  # el health check de Render usa HTTP
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = env_int('SECURE_HSTS_SECONDS', 0)  # súbelo (ej. 31536000) cuando todo funcione
    SECURE_CONTENT_TYPE_NOSNIFF = True

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': os.getenv('LOG_LEVEL', 'INFO')},
}

# ---------------------------------------------------------------------------
# Identificación botánica (Pl@ntNet) - Fase 3A
# ---------------------------------------------------------------------------
# Sin PLANTNET_API_KEY el endpoint /identificacion/ responde en modo SIMULADO (resultados de ejemplo).
PLANTNET_API_KEY = os.getenv('PLANTNET_API_KEY', '')
PLANTNET_API_URL = os.getenv('PLANTNET_API_URL', 'https://my-api.plantnet.org/v2/identify/all')
PLANTNET_LANG = os.getenv('PLANTNET_LANG', 'es')
PLANTNET_MAX_RESULTS = env_int('PLANTNET_MAX_RESULTS', 3)
# La app espera la respuesta completa en < 3 s (SC-01): se deja margen para subir la foto y responder.
PLANTNET_TIMEOUT_SECONDS = float(os.getenv('PLANTNET_TIMEOUT_SECONDS', '2.2'))
IDENTIFICATION_MODE = os.getenv('IDENTIFICATION_MODE', 'auto')  # auto | simulated
IDENTIFICATION_MAX_IMAGE_BYTES = env_int('IDENTIFICATION_MAX_IMAGE_BYTES', 1_000_000)  # SC-05: < 1 MB
