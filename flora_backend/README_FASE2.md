# F.L.O.R.A. · Backend — Fase 2: Datos del jardín y sincronización

> **Sin ejecutar.** Igual que la Fase 1, este código se escribió sin poder correr Django.
> Sigue la sección 2 (migraciones + `pytest`) antes de integrarlo.

## 1. Qué incluye

| Módulo | Archivos |
|---|---|
| Modelo 3NF | `plants/models.py`, `plants/migrations/0001_initial.py`, `0002_seed_categories.py` |
| Reglas puras (sin Django) | `plants/logic.py` |
| Casos de uso | `plants/services.py` (riegos, rachas, agenda), `plants/sync.py` (lotes offline) |
| API | `plants/serializers.py`, `views.py`, `urls.py`, `admin.py` |
| Pruebas | `plants/tests/` (≈70 funciones) |
| Config | `config/settings.py` (+`'plants'`), `config/urls.py` (+ rutas), `pytest.ini` |

**Requiere la Fase 1** (`accounts`: usuarios y JWT). Este zip se descomprime SOBRE la carpeta del backend.

## 2. Aplicar y validar

```powershell
cd C:\Users\josej\Desktop\flora_app\flora_backend
Expand-Archive -Path <ruta>\flora_backend_fase2_plantas.zip -DestinationPath . -Force
.venv\Scripts\Activate.ps1
python manage.py makemigrations --check --dry-run   # "No changes detected"
python manage.py migrate
pytest                                              # Fase 1 + Fase 2
python manage.py runserver 0.0.0.0:8000
```
Si `makemigrations --check` propone cambios en `plants`: borra `plants/migrations/0001_initial.py`, ejecuta
`python manage.py makemigrations plants` y deja `0002_seed_categories.py` dependiendo del nuevo 0001.

## 3. Modelo de datos

```
cuentas ─┬─< plantas >── categorias_planta
         └── rachas (1:1)
plantas ─┬─< riegos
         └─< fotos_planta
```
* Borrado en cascada: usuario → plantas, riegos, fotos y racha; planta → riegos y fotos.
* `categorias_planta` es `PROTECT` (no se borra si hay plantas) y viene sembrada: Tropical, Suculenta, Aromática, Helecho.
* **Entidad extra `riegos`:** el DAS lista 5 entidades; el historial de riegos hace falta para sincronizar sin duplicar
  (`UNIQUE planta + instante`) y calcular rachas. No guarda datos derivados.
* Si el docente exige "especie" como entidad propia (3NF estricta), `nombre_cientifico`/`especie_slug` pasarían a una tabla `especies`.

## 4. Contratos (todos con `Authorization: Bearer <access>`)

| Ruta | Descripción |
|---|---|
| `GET /plantas/` | Lista **simple** (no paginada) solo de MIS plantas |
| `POST /plantas/` | Crea. Acepta `client_local_id` (reintento idempotente: 200 con la misma planta) |
| `GET/PATCH/DELETE /plantas/{id}/` | Ajenas → 404 |
| `POST /plantas/{id}/riegos/` | `{regado_en?}` → 201 `{riego, planta, racha}`; mismo instante → 200 (idempotente); futuro → 400 |
| `GET /plantas/{id}/riegos/` | Historial (últimos 100) |
| `GET /rachas/me/` | `{racha_actual, mejor_racha, ultimo_dia, hecho_hoy, en_riesgo, mascota_nombre}` |
| `PATCH /rachas/me/` | `{mascota_nombre}` (2–20 caracteres) |
| `GET /agenda/?dias=14` | Próximos riegos con frecuencia ajustada (1–60 días) |
| `POST /sync/batch/` | Cola offline de la app (hasta 200 operaciones) |

Planta (salida): `id, nombre_comun, nombre_cientifico, categoria (nombre), especie_slug, nivel_luz, ubicacion,
frecuencia_base_dias, frecuencia_riego_dias (efectiva), ultimo_riego, foto_url, creado_en`.
La app envía la frecuencia **base**; el servidor devuelve la **efectiva** (ajustada a la luz).

### `/sync/batch/`
```json
POST { "operaciones": [ { "client_id": 7, "tipo": "planta_nueva|riego", "payload": {...}, "creado_en": "ISO" } ] }
200  { "procesadas": [7], "rechazadas": [ { "client_id": 8, "motivo": "planta_no_encontrada" } ],
       "mapeo_plantas": [ { "local_id": -1700000000000001, "server_id": 42 } ] }
```
* Se procesa en orden cronológico; **cada operación en su propia transacción** (una mala no tumba el lote).
* **Idempotente:** `planta_nueva` por `(usuario, client_local_id)`; `riego` por `(planta, instante)`.
* `riego.planta_id` acepta el id del servidor o el id local negativo de la app.
* Motivos: `tipo_desconocido`, `payload_invalido: …`, `planta_no_encontrada`, `fecha_futura`, `error_interno`.
* Una categoría desconocida se ignora (la planta se crea sin categoría).

## 5. Reglas de negocio (idénticas a la app)

* **Evaporación (HU-008):** `frecuencia = max(1, round_JS(base × factor))`, factor = baja 1.3 · media 1.0 · alta 0.8.
  Se usa `floor(x + 0.5)` y NO `round()`: Python redondea 6.5 a 6 y la app a 7.
* **Racha:** un día cuenta si hay ≥1 riego (día calendario de Chile, `America/Santiago`). Sigue viva si el último riego fue
  hoy o ayer. Un riego de un día anterior al último que llega tarde se guarda pero no altera la racha.
* **Agenda:** `próximo = último riego (día local) + frecuencia efectiva`; sin riegos = hoy. Estados: atrasada / hoy / ok.

## 6. Pendiente (Fase 3)
`/identificacion/` (Pl@ntNet), subida de fotos a Supabase Storage (`fotos_planta.url`), `/diagnostico/`, Swagger/OpenAPI, cobertura >80 %.
