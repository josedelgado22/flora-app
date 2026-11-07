"""HU-FLOR-012: reglas de diagnóstico (puras) y endpoints."""
import pytest

from plants.diagnosis import SYMPTOM_IDS, SYMPTOMS, extra_advice, get_symptom
from plants.tests.helpers import at_noon


# ---- Reglas puras ----------------------------------------------------------
def test_el_catalogo_tiene_los_cuatro_sintomas_de_la_app():
    assert SYMPTOM_IDS == ('s1', 's2', 's3', 's4')
    assert all(symptom['causa'] and symptom['solucion'] for symptom in SYMPTOMS)


def test_get_symptom_devuelve_una_copia_o_none():
    symptom = get_symptom('s1')
    assert symptom['tipo'] == 'exceso'
    symptom['causa'] = 'modificada'
    assert get_symptom('s1')['causa'] != 'modificada'
    assert get_symptom('zzz') is None


def test_exceso_de_riego_en_suculenta_y_sin_necesidad_de_riego():
    advice = extra_advice('s1', categoria='Suculenta', dias_restantes=3)
    assert len(advice) == 2


def test_falta_de_riego_atrasada_en_tropical_de_interior():
    advice = extra_advice('s2', categoria='Tropical', ubicacion='interior', dias_restantes=-2)
    assert any('2 días atrasada' in line for line in advice)
    assert any('humedad ambiental' in line for line in advice)
    assert any('1 día atrasada' in line for line in extra_advice('s2', dias_restantes=-1))


def test_hongos_en_interior_y_luz_baja():
    assert extra_advice('s3', ubicacion='interior')
    assert extra_advice('s3', ubicacion='exterior') == []
    assert any('luz baja' in line for line in extra_advice('s4', nivel_luz='baja'))


def test_sin_datos_de_la_planta_no_hay_recomendaciones_adicionales():
    assert all(extra_advice(symptom_id) == [] for symptom_id in SYMPTOM_IDS)


# ---- Endpoints -------------------------------------------------------------
@pytest.mark.django_db
def test_requiere_autenticacion(anon):
    assert anon.post('/api/v1/diagnostico/', {'sintoma_id': 's1'}, format='json').status_code == 401
    assert anon.get('/api/v1/diagnostico/sintomas/').status_code == 401


@pytest.mark.django_db
def test_lista_el_catalogo(api):
    response = api.get('/api/v1/diagnostico/sintomas/')
    assert response.status_code == 200
    assert [item['sintoma_id'] for item in response.json()] == list(SYMPTOM_IDS)


@pytest.mark.django_db
def test_diagnostico_sin_planta(api):
    response = api.post('/api/v1/diagnostico/', {'sintoma_id': 's3'}, format='json')
    assert response.status_code == 200
    body = response.json()
    assert body['sintoma_id'] == 's3'
    assert body['tipo'] == 'hongo'
    assert body['recomendaciones_adicionales'] == []


@pytest.mark.django_db
def test_sintoma_desconocido_responde_400(api):
    assert api.post('/api/v1/diagnostico/', {'sintoma_id': 'zzz'}, format='json').status_code == 400
    assert api.post('/api/v1/diagnostico/', {}, format='json').status_code == 400


@pytest.mark.django_db
def test_diagnostico_con_planta_propia_agrega_recomendaciones(api, plant):
    from plants import services

    services.register_watering(plant, at_noon(10))  # frecuencia 7 -> atrasada 3 días
    response = api.post('/api/v1/diagnostico/', {'sintoma_id': 's2', 'planta_id': plant.id}, format='json')

    assert response.status_code == 200
    advice = response.json()['recomendaciones_adicionales']
    assert any('3 días atrasada' in line for line in advice)  # planta: Tropical, interior


@pytest.mark.django_db
def test_planta_ajena_o_inexistente_responde_404(api, other_plant):
    assert api.post('/api/v1/diagnostico/', {'sintoma_id': 's1', 'planta_id': other_plant.id}, format='json').status_code == 404
    assert api.post('/api/v1/diagnostico/', {'sintoma_id': 's1', 'planta_id': 999999}, format='json').status_code == 404
