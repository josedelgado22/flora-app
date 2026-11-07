from datetime import date, timedelta

import pytest
from django.utils import timezone

from plants import services
from plants.logic import project_due_dates
from plants.tests.helpers import at_noon

TODAY = date(2026, 10, 28)


# ---- Lógica pura (espejo de schedule.js) ----------------------------------
def test_sin_riegos_vence_hoy_y_proyecta_cada_frecuencia():
    assert project_due_dates(None, 7, TODAY, 14) == [
        {'dias_restantes': 0, 'proyectado': False},
        {'dias_restantes': 7, 'proyectado': True},
    ]


def test_planta_al_dia():
    result = project_due_dates(TODAY - timedelta(days=2), 7, TODAY, 14)
    assert [(e['dias_restantes'], e['proyectado']) for e in result] == [(5, False), (12, True)]


def test_planta_atrasada_el_primer_riego_es_negativo_y_los_siguientes_parten_de_hoy():
    result = project_due_dates(TODAY - timedelta(days=10), 7, TODAY, 14)
    assert [(e['dias_restantes'], e['proyectado']) for e in result] == [(-3, False), (7, True)]


def test_frecuencia_corta_genera_varios_riegos():
    offsets = [e['dias_restantes'] for e in project_due_dates(None, 3, TODAY, 14)]
    assert offsets == [0, 3, 6, 9, 12]


def test_proximo_riego_fuera_del_horizonte_no_genera_eventos():
    assert project_due_dates(TODAY, 20, TODAY, 14) == []


# ---- Endpoints -------------------------------------------------------------
@pytest.mark.django_db
def test_agenda_de_una_planta(api, plant):
    services.register_watering(plant, at_noon(2))

    response = api.get(f'/api/v1/plantas/{plant.id}/agenda/?dias=14')

    assert response.status_code == 200
    body = response.json()
    assert body['planta_id'] == plant.id
    assert [r['dias_restantes'] for r in body['riegos']] == [5, 12]
    assert [r['proyectado'] for r in body['riegos']] == [False, True]
    assert body['riegos'][0]['fecha'] == str(timezone.localdate() + timedelta(days=5))


@pytest.mark.django_db
def test_agenda_de_planta_ajena_responde_404(api, other_plant):
    assert api.get(f'/api/v1/plantas/{other_plant.id}/agenda/').status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize('dias', ['0', '61', 'abc'])
def test_horizonte_invalido_responde_400(api, plant, dias):
    assert api.get(f'/api/v1/plantas/{plant.id}/agenda/?dias={dias}').status_code == 400


@pytest.mark.django_db
def test_agenda_global_incluye_riegos_solo_si_se_pide(api, plant):
    plain = api.get('/api/v1/agenda/').json()
    assert 'riegos' not in plain['items'][0]

    full = api.get('/api/v1/agenda/?proyeccion=1').json()
    assert [r['dias_restantes'] for r in full['items'][0]['riegos']] == [0, 7]
