import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework.throttling import ScopedRateThrottle

from identification import errors, plantnet

pytestmark = pytest.mark.django_db

URL = '/api/v1/identificacion/'
JPEG = b'\xff\xd8\xff\xe0' + b'\x00' * 200
PNG = b'\x89PNG\r\n\x1a\n' + b'\x00' * 200

REQUIRED = {'id', 'nombre_comun', 'nombre_cientifico', 'categoria', 'nivel_luz_ideal', 'ubicacion_ideal',
            'frecuencia_riego_dias', 'temperatura', 'consejos', 'coincidencia', 'en_catalogo', 'datos_estimados'}


def send(api, data=JPEG, name='planta.jpg', content_type='image/jpeg', **extra):
    return api.post(URL, {'imagen': SimpleUploadedFile(name, data, content_type), **extra}, format='multipart')


def raw(name, score, common=None):
    return {'score': score, 'scientific_name': name, 'common_names': common or [], 'family': None}


def test_requires_authentication():
    assert send(APIClient()).status_code == 401


# ---------------- modo simulado (sin clave) ----------------
def test_simulated_mode_returns_three_catalog_candidates(api):
    response = send(api)

    assert response.status_code == 200
    body = response.json()
    assert body['fuente'] == 'simulado' and isinstance(body['tiempo_ms'], int)
    assert [c['coincidencia'] for c in body['resultados']] == [93, 64, 41]
    for candidate in body['resultados']:
        assert REQUIRED <= set(candidate) and candidate['en_catalogo'] is True


def test_simulated_mode_is_deterministic_for_the_same_photo(api):
    first = [c['id'] for c in send(api).json()['resultados']]
    second = [c['id'] for c in send(api).json()['resultados']]

    assert first == second


def test_png_is_accepted(api):
    assert send(api, PNG, 'planta.png', 'image/png').status_code == 200


# ---------------- modo real (Pl@ntNet simulado con monkeypatch) ----------------
@pytest.fixture
def real(settings):
    settings.PLANTNET_API_KEY = 'una-clave'


def test_real_mode_maps_results_to_the_catalog_and_estimates_unknown_species(api, real, monkeypatch):
    monkeypatch.setattr(plantnet, 'identify', lambda *a, **k: [
        raw('Monstera deliciosa', 0.91), raw('Sansevieria trifasciata', 0.5), raw('Rosa gallica', 0.2, ['Rosa de Castilla'])])

    body = send(api).json()

    assert body['fuente'] == 'plantnet'
    assert [c['id'] for c in body['resultados']] == ['monstera-deliciosa', 'sansevieria-trifasciata', 'rosa-gallica']
    assert [c['coincidencia'] for c in body['resultados']] == [91, 50, 20]
    assert body['resultados'][2]['datos_estimados'] is True and body['resultados'][2]['nombre_comun'] == 'Rosa de Castilla'
    assert all(REQUIRED <= set(c) for c in body['resultados'])


def test_real_mode_passes_the_organ_and_the_sniffed_content_type(api, real, monkeypatch):
    seen = {}

    def fake(image_bytes, filename, content_type, organ):
        seen.update(filename=filename, content_type=content_type, organ=organ)
        return []

    monkeypatch.setattr(plantnet, 'identify', fake)

    send(api, JPEG, 'x.jpg', 'text/plain', organ='flower')   # el cliente miente en el Content-Type

    assert seen == {'filename': 'x.jpg', 'content_type': 'image/jpeg', 'organ': 'flower'}


def test_no_match_returns_an_empty_list_not_an_error(api, real, monkeypatch):
    monkeypatch.setattr(plantnet, 'identify', lambda *a, **k: [])

    response = send(api)

    assert response.status_code == 200 and response.json()['resultados'] == []


@pytest.mark.parametrize('factory,status,code', [(errors.ai_timeout, 504, 'ai_timeout'),
                                                 (errors.ai_unavailable, 502, 'ai_unavailable'),
                                                 (errors.ai_quota, 503, 'ai_quota')])
def test_ai_failures_return_5xx_so_the_app_falls_back_to_the_quiz(api, real, monkeypatch, factory, status, code):
    def boom(*args, **kwargs):
        raise factory()

    monkeypatch.setattr(plantnet, 'identify', boom)

    response = send(api)

    assert response.status_code == status and response.json()['code'] == code
    assert 'detail' in response.json()


def test_forced_simulated_mode_ignores_the_key(api, real, settings, monkeypatch):
    settings.IDENTIFICATION_MODE = 'simulated'
    monkeypatch.setattr(plantnet, 'identify', lambda *a, **k: pytest.fail('no debe llamar a Pl@ntNet'))

    assert send(api).json()['fuente'] == 'simulado'


# ---------------- validación de la imagen ----------------
def test_missing_image_returns_400(api):
    response = api.post(URL, {}, format='multipart')

    assert response.status_code == 400 and response.json()['code'] == 'validation_error'


def test_a_file_that_is_not_an_image_returns_400(api):
    response = send(api, b'esto es texto, no una foto', 'planta.jpg', 'image/jpeg')

    assert response.status_code == 400 and response.json()['code'] == 'invalid_image'


def test_oversized_photo_returns_413(api, settings):
    settings.IDENTIFICATION_MAX_IMAGE_BYTES = 100

    response = send(api)

    assert response.status_code == 413 and response.json()['code'] == 'image_too_large'


def test_invalid_organ_returns_400(api):
    response = send(api, organ='raiz')

    assert response.status_code == 400 and 'organ' in response.json()['errors']


# ---------------- protección de la cuota ----------------
def test_identification_is_rate_limited(api, monkeypatch):
    monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {'identify': '2/min'})

    assert send(api).status_code == 200 and send(api).status_code == 200
    third = send(api)

    assert third.status_code == 429 and third.json()['code'] == 'throttled'
