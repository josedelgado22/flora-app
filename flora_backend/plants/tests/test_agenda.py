import pytest

from plants.models import Plant
from plants.tests.helpers import at_noon

pytestmark = pytest.mark.django_db

AGENDA = '/api/v1/agenda/'


def make(user, name, base, light, watered_days_ago=None):
    return Plant.objects.create(
        user=user,
        nombre_comun=name,
        frecuencia_base_dias=base,
        nivel_luz=light,
        ultimo_riego=at_noon(watered_days_ago) if watered_days_ago is not None else None,
    )


def item_for(body, plant):
    return next(i for i in body['items'] if i['planta_id'] == plant.id)


def test_agenda_requires_authentication(anon):
    assert anon.get(AGENDA).status_code == 401


def test_overdue_today_and_upcoming_states(api, user):
    overdue = make(user, 'Atrasada', 7, 'media', watered_days_ago=8)   # vencía ayer
    today = make(user, 'Hoy', 7, 'media', watered_days_ago=7)
    later = make(user, 'Luego', 7, 'media', watered_days_ago=3)

    body = api.get(AGENDA).json()

    assert item_for(body, overdue)['estado'] == 'atrasada' and item_for(body, overdue)['dias_restantes'] == -1
    assert item_for(body, today)['estado'] == 'hoy' and item_for(body, today)['dias_restantes'] == 0
    assert item_for(body, later)['estado'] == 'ok' and item_for(body, later)['dias_restantes'] == 4
    assert body['resumen'] == {'atrasadas': 1, 'hoy': 1}


def test_light_adjusts_the_frequency_through_evaporation(api, user):
    sunny = make(user, 'Sol', 7, 'alta', watered_days_ago=8)    # 7 * 0.8 = 6 días -> atrasada 2
    shady = make(user, 'Sombra', 7, 'baja', watered_days_ago=8)  # 7 * 1.3 = 9 días -> falta 1

    body = api.get(AGENDA).json()

    assert item_for(body, sunny)['frecuencia_riego_dias'] == 6
    assert item_for(body, sunny)['factor_evaporacion'] == 0.8
    assert item_for(body, sunny)['dias_restantes'] == -2
    assert item_for(body, shady)['frecuencia_riego_dias'] == 9
    assert item_for(body, shady)['dias_restantes'] == 1


def test_rounding_matches_the_mobile_app(api, user):
    plant = make(user, 'Redondeo', 5, 'baja', watered_days_ago=0)   # 5 * 1.3 = 6.5 -> 7 (no 6)

    assert item_for(api.get(AGENDA).json(), plant)['frecuencia_riego_dias'] == 7


def test_plant_without_waterings_is_due_today(api, user):
    plant = make(user, 'Nueva', 7, 'media')

    item = item_for(api.get(AGENDA).json(), plant)

    assert item['estado'] == 'hoy' and item['ultimo_riego'] is None


def test_items_are_sorted_by_urgency_then_name(api, user):
    make(user, 'Zeta', 7, 'media', watered_days_ago=3)
    make(user, 'Beta', 7, 'media', watered_days_ago=9)
    make(user, 'Alfa', 7, 'media', watered_days_ago=9)

    names = [i['nombre_comun'] for i in api.get(AGENDA).json()['items']]

    assert names == ['Alfa', 'Beta', 'Zeta']


def test_horizon_filters_far_away_waterings(api, user):
    near = make(user, 'Cerca', 7, 'media', watered_days_ago=3)     # en 4 días
    far = make(user, 'Lejos', 30, 'media', watered_days_ago=0)     # en 30 días

    ids = [i['planta_id'] for i in api.get(AGENDA, {'dias': 7}).json()['items']]

    assert near.id in ids and far.id not in ids


@pytest.mark.parametrize('value', ['abc', '0', '61'])
def test_horizon_is_validated(api, value):
    response = api.get(AGENDA, {'dias': value})

    assert response.status_code == 400 and response.json()['code'] == 'validation_error'


def test_agenda_only_shows_my_plants(api, user, other_plant):
    mine = make(user, 'Mia', 7, 'media', watered_days_ago=1)

    ids = [i['planta_id'] for i in api.get(AGENDA).json()['items']]

    assert ids == [mine.id]
