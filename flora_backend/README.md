# F.L.O.R.A. · Backend — Fase 1: Autenticación + OTP/2FA

Django REST Framework · JWT (HS256) · PostgreSQL (Supabase) / SQLite local · Render.
Implementa los contratos de `src/services/authService.js` de la app móvil.

> **Estado de verificación.** Este código se escribió sin poder ejecutar Django. Antes de integrarlo,
> **corre los pasos de la sección 2** (migración + `pytest`). Si algo falla, el mensaje de pytest apunta a la línea exacta.

## 1. Módulos (para copiar por fases)

| Fase | Módulo | Archivos | Depende de |
|---|---|---|---|
| 1 | **Base del proyecto** | `config/` (settings, urls, wsgi), `manage.py`, `requirements*.txt`, `.env.example` | — |
| 2 | **Modelos** (3NF) | `accounts/models.py`, `accounts/migrations/0001_initial.py`, `accounts/apps.py`, `accounts/admin.py` | 1 |
| 3 | **OTP + correo** | `accounts/otp_utils.py`, `accounts/otp.py`, `accounts/emails.py`, `accounts/exceptions.py` | 2 |
| 4 | **API** | `accounts/serializers.py`, `services.py`, `views.py`, `urls.py` | 3 |
| 5 | **Pruebas** | `accounts/tests/`, `pytest.ini`, `config/settings_test.py` | 4 |
| 6 | **Despliegue** | `build.sh`, `render.yaml` | 1–4 |
| — | Mantenimiento | `accounts/management/commands/purge_otps.py` | 2 |

Tablas: `cuentas` (usuario) y `codigos_otp` (N códigos por cuenta, FK a `cuentas`).
Las demás entidades de la 3NF (`categorias_planta`, `plantas`, `rachas`, `fotos_planta`) y los endpoints
`/plantas/`, `/identificacion/`, `/sync/batch/` son las **fases siguientes**.

> En el árbol de la app ya existe una carpeta `flora_backend/`. Extrae este zip en una carpeta aparte
> y fusiona por módulos; no lo descomprimas encima sin revisar.

## 2. Puesta en marcha local (PowerShell)

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env

python manage.py makemigrations --check --dry-run   # debe decir "No changes detected"
python manage.py migrate
pytest                                              # toda la suite debe pasar
python manage.py runserver 0.0.0.0:8000
```

* Si `makemigrations --check` propone cambios: borra `accounts/migrations/0001_initial.py` y ejecuta
  `python manage.py makemigrations accounts` (la migración inicial incluida se escribió a mano).
* Sin credenciales SMTP, el correo **se imprime en la consola**: ahí verás el código de 6 dígitos.
* App en emulador Android: `API_BASE_URL = http://10.0.2.2:8000/api/v1`. En celular físico usa la IP de tu PC y agrégala a `ALLOWED_HOSTS`.

## 3. Contratos

Base: `/api/v1`. Errores siempre como `{ "code": "...", "detail": "..." }` (+ `errors` en validaciones).

| Método y ruta | Entrada | Éxito | Errores |
|---|---|---|---|
| `POST /auth/register/` | `nombre, apellido, email, password` | **202** `{requires_verification, challenge_id, method, email_hint, expires_in}` (cuenta inactiva) | 400 `validation_error` · 409 `email_exists` · 503 `email_send_failed` |
| `POST /auth/register/verify/` | `challenge_id, code` | **200** `{access, refresh, user}` (activa la cuenta) | 400 `invalid_code` / `challenge_expired` / `too_many_attempts` |
| `POST /auth/register/resend/` | `challenge_id` | **200** `{expires_in}` | 400 `challenge_expired` · 429 `resend_too_soon` · 503 |
| `POST /auth/login/` | `email, password` | **200** `{access, refresh, user}` **o** `{requires_2fa, challenge_id, method, email_hint, expires_in}` | **401** `invalid_credentials` · **403** `account_not_verified` |
| `POST /auth/2fa/verify/` | `challenge_id, code` | **200** `{access, refresh, user}` | 400 (igual que arriba) |
| `POST /auth/2fa/resend/` | `challenge_id` | **200** `{expires_in}` | 400 · 429 · 503 |
| `POST /auth/token/refresh/` | `refresh` | **200** `{access}` | 401 |
| `GET /auth/me/` | `Authorization: Bearer <access>` | **200** `{id, email, nombre, apellido, fecha_registro}` | 401 |
| `GET /health/` | — | **200** `{status: "ok"}` | — |

*`/auth/login/` no estaba en tu lista pero es imprescindible: es el que dispara el 2FA.*

### Reglas del OTP
* 6 dígitos (`secrets`), **vence a los 5 min**, **un solo uso**; `created_at` se renueva al reenviar.
* Se guarda como **HMAC-SHA256** ligado al `challenge_id` (campo `code`); nunca en claro.
* Máx. 5 intentos fallidos por código → `too_many_attempts` hasta reenviar. Reenvío con enfriamiento de 30 s.
* Un registro nuevo (o un login nuevo) **invalida** el código pendiente anterior del mismo propósito.
* Si el correo no se puede enviar, la transacción se revierte (no queda cuenta ni código huérfano).
* Límite por IP en los endpoints públicos (`AUTH_THROTTLE_RATE`, por defecto 30/min).

## 4. Correo (SMTP)

Variables: `EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, EMAIL_USE_TLS/EMAIL_USE_SSL, DEFAULT_FROM_EMAIL`.
Ejemplos para Gmail (contraseña de aplicación), Resend y Brevo en `.env.example`
(confirma host/puerto en la documentación vigente de cada proveedor).
Sin `EMAIL_HOST_USER` se usa el backend de consola → en Render el código aparece en **Logs** (útil para demos; no para producción).

## 5. Despliegue en Render + Supabase

1. Sube el backend a GitHub. Si vive en una subcarpeta, agrega `rootDir: <carpeta>` al servicio en `render.yaml`.
2. Render → **New → Blueprint** → elige el repositorio (usa `render.yaml`).
3. Completa las variables `sync: false`: `DATABASE_URL` (Supabase; si la conexión directa falla usa la URL del *pooler*, y con el modo *transaction* pon `DB_DISABLE_SERVER_SIDE_CURSORS=True`), SMTP, `DEFAULT_FROM_EMAIL`.
4. `build.sh` instala, ejecuta `collectstatic` y **`migrate` contra PostgreSQL** en cada despliegue.
5. Prueba: `https://<tu-servicio>.onrender.com/api/v1/health/`.
6. Opcional: Render Cron Job con `python manage.py purge_otps` (diario).

## 6. Conectar la app móvil

`src/config/appConfig.js`:
```js
export const API_BASE_URL = 'https://<tu-servicio>.onrender.com/api/v1';
export const FORCE_MOCKS = false;
```
El plan gratuito de Render duerme el servicio: la primera petición puede tardar ~30 s y activar el timeout de 3 s de la app.

## 7. Integrar en un proyecto Django existente
1. Copia la carpeta `accounts/` y agrega `'accounts'` a `INSTALLED_APPS`.
2. **Define `AUTH_USER_MODEL = 'accounts.User'` antes de la primera migración** (no se puede cambiar después sin rehacer la base).
3. Copia de `config/settings.py` los bloques: `REST_FRAMEWORK`, `SIMPLE_JWT`, OTP, correo, base de datos y seguridad.
4. En `urls.py`: `path('api/v1/auth/', include('accounts.urls'))` y `HealthView`.

## 8. Notas de seguridad
* Rota `SECRET_KEY` por servicio (firma los JWT y deriva el HMAC de los OTP; si cambia, los códigos pendientes dejan de valer).
* Sube `SECURE_HSTS_SECONDS` cuando el HTTPS esté estable.
* Tras un 5° intento fallido el usuario debe reenviar el código; el límite por IP protege contra abuso masivo.
* Pendiente (fase siguiente): lista negra de refresh tokens al cerrar sesión, recuperación de contraseña y OpenAPI (drf-spectacular).
