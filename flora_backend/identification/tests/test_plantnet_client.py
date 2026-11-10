"""Cliente de Pl@ntNet con requests simulado (no hace llamadas reales)."""
import logging

import pytest
import requests

from identification import plantnet

KEY = '22b10PTGfSjfezwIBNSoIYPv8e'


class FakeResponse:
    def __init__(self, status=200, payload=None, bad_json=False):
        self.status_code, self._payload, self._bad_json = status, payload, bad_json

    def json(self):
        if self._bad_json:
            raise ValueError('no es JSON')
        return self._payload


OK = {'results': [{'score': 0.93, 'species': {'scientificNameWithoutAuthor': 'Monstera deliciosa',
                                                'commonNames': ['Costilla de Adán']}}]}


@pytest.fixture(autouse=True)
def configured(settings):
    settings.PLANTNET_API_KEY = KEY
    settings.PLANTNET_TIMEOUT_SECONDS = 2.2


def call():
    return plantnet.identify(b'\xff\xd8\xff-foto', 'planta.jpg', 'image/jpeg', 'leaf')


def patch_post(monkeypatch, behaviour):
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        if isinstance(behaviour, Exception):
            raise behaviour
        return behaviour

    monkeypatch.setattr(plantnet.requests, 'post', fake_post)
    return calls


def test_success_sends_the_expected_request_and_parses_the_result(monkeypatch, settings):
    calls = patch_post(monkeypatch, FakeResponse(200, OK))

    result = call()

    assert result[0]['scientific_name'] == 'Monstera deliciosa' and result[0]['score'] == 0.93
    url, kwargs = calls[0]
    assert url == settings.PLANTNET_API_URL
    assert kwargs['params']['api-key'] == KEY and kwargs['params']['lang'] == 'es'
    assert kwargs['data'] == {'organs': 'leaf'}
    assert kwargs['files'][0][0] == 'images' and kwargs['files'][0][1][2] == 'image/jpeg'
    assert kwargs['timeout'] == (plantnet.CONNECT_TIMEOUT_SECONDS, 2.2)   # SC-01: no esperar más de lo permitido


def test_timeout_maps_to_504_ai_timeout(monkeypatch):
    patch_post(monkeypatch, requests.Timeout('lento'))

    with pytest.raises(Exception) as exc:
        call()

    assert exc.value.get_codes() == 'ai_timeout' and exc.value.status_code == 504


@pytest.mark.parametrize('failure', [requests.ConnectionError('sin red'), requests.exceptions.SSLError('ssl')])
def test_network_errors_map_to_502(monkeypatch, failure):
    patch_post(monkeypatch, failure)

    with pytest.raises(Exception) as exc:
        call()

    assert exc.value.get_codes() == 'ai_unavailable' and exc.value.status_code == 502


@pytest.mark.parametrize('status,code,http', [(429, 'ai_quota', 503), (401, 'ai_unavailable', 502),
                                              (403, 'ai_unavailable', 502), (500, 'ai_unavailable', 502)])
def test_http_errors_are_translated(monkeypatch, status, code, http):
    patch_post(monkeypatch, FakeResponse(status))

    with pytest.raises(Exception) as exc:
        call()

    assert exc.value.get_codes() == code and exc.value.status_code == http


def test_404_means_no_species_found_not_an_error(monkeypatch):
    patch_post(monkeypatch, FakeResponse(404))

    assert call() == []


def test_invalid_json_maps_to_502(monkeypatch):
    patch_post(monkeypatch, FakeResponse(200, bad_json=True))

    with pytest.raises(Exception) as exc:
        call()

    assert exc.value.get_codes() == 'ai_unavailable'


def test_the_api_key_is_never_written_to_the_logs(monkeypatch, caplog):
    patch_post(monkeypatch, requests.ConnectionError(f'fallo https://my-api.plantnet.org/v2?api-key={KEY}'))

    with caplog.at_level(logging.DEBUG), pytest.raises(Exception):
        call()

    assert KEY not in caplog.text
