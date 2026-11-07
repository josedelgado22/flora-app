from datetime import datetime, timedelta

import pytest
from django.utils import timezone

from plants.models import Racha, Riego
from plants.tests.helpers import at_noon

pytestmark = pytest.mark.django_db

PLANTS = '/api/v1/plantas/'
RACHA = '/api/v1/rachas/me/'


def water(api, plant, when=None):
    payload = {} if when is None else {'regado_en': when.isoformat()}
    return api.post(f'{PLANTS}{plant.id}/riegos/', payload, format='json')


def test_watering_updates_last_watering_and_starts_a_streak(api, plant):
    response = water(api, plant)

    assert response.status_code == 201
    body = response.json()
    assert body['planta']['ultimo_riego'] is not None
    assert body['racha']['racha_actual'] == 1 and body['racha']['hecho_hoy'] is True
    plant.refresh_from_db()
    assert plant.ultimo_riego is not None and Riego.objects.count() == 1


def test_watering_is_idempotent_for_the_same_instant(api, plant):
    moment = at_noon(1)

    first, second = water(api, plant, moment), water(api, plant, moment)

    assert (first.status_code, second.status_code) == (201, 200)
    assert Riego.objects.count() == 1
    assert Racha.objects.get().racha_actual == 1


def test_future_watering_is_rejected(api, plant):
    response = water(api, plant, timezone.now() + timedelta(days=1))

    assert response.status_code == 400
    assert response.json()['code'] == 'validation_error'
    assert Riego.objects.count() == 0


def test_cannot_water_someone_elses_plant(api, other_plant):
    assert water(api, other_plant).status_code == 404
    assert Riego.objects.count() == 0


def test_history_lists_waterings_newest_first(api, plant):
    for days in (3, 1, 2):
        water(api, plant, at_noon(days))

    response = api.get(f'{PLANTS}{plant.id}/riegos/')

    assert response.status_code == 200
    # se comparan como fechas (no como texto: el desfase horario puede cambiar por el horario de verano)
    dates = [datetime.fromisoformat(item['regado_en'].replace('Z', '+00:00')) for item in response.json()]
    assert len(dates) == 3 and dates == sorted(dates, reverse=True)


def test_consecutive_days_build_the_streak(api, plant):
    for days in (3, 2, 1):
        water(api, plant, at_noon(days))
    water(api, plant)  # hoy

    body = api.get(RACHA).json()

    assert body['racha_actual'] == 4 and body['mejor_racha'] == 4
    assert body['hecho_hoy'] is True and body['en_riesgo'] is False


def test_streak_is_at_risk_until_today_is_watered(api, plant):
    for days in (2, 1):
        water(api, plant, at_noon(days))

    body = api.get(RACHA).json()

    assert body['racha_actual'] == 2
    assert body['hecho_hoy'] is False and body['en_riesgo'] is True


def test_a_gap_resets_the_current_streak_but_keeps_the_best(api, plant):
    for days in (6, 5, 4):
        water(api, plant, at_noon(days))
    water(api, plant, at_noon(1))

    body = api.get(RACHA).json()

    assert body['racha_actual'] == 1 and body['mejor_racha'] == 3


def test_an_old_streak_is_no_longer_valid(api, plant):
    for days in (5, 4, 3):
        water(api, plant, at_noon(days))

    body = api.get(RACHA).json()

    assert body['racha_actual'] == 0 and body['mejor_racha'] == 3 and body['en_riesgo'] is False


def test_late_arriving_older_watering_does_not_break_the_streak(api, plant):
    water(api, plant, at_noon(1))  # ayer
    water(api, plant)              # hoy -> racha 2
    water(api, plant, at_noon(9))  # llega tarde por sincronización: se guarda, pero no altera la racha

    body = api.get(RACHA).json()

    assert body['racha_actual'] == 2
    plant.refresh_from_db()
    assert timezone.localtime(plant.ultimo_riego).date() == timezone.localdate()  # sigue el más reciente


def test_streaks_are_per_user(api, other_api, plant):
    water(api, plant)

    assert other_api.get(RACHA).json()['racha_actual'] == 0


def test_new_user_has_an_empty_streak_and_default_pet(api):
    body = api.get(RACHA).json()

    assert body == {
        'racha_actual': 0, 'mejor_racha': 0, 'ultimo_dia': None,
        'hecho_hoy': False, 'en_riesgo': False, 'mascota_nombre': 'Espina',
    }


def test_the_pet_can_be_renamed(api):
    response = api.patch(RACHA, {'mascota_nombre': 'Pepa'}, format='json')

    assert response.status_code == 200 and response.json()['mascota_nombre'] == 'Pepa'
    assert api.get(RACHA).json()['mascota_nombre'] == 'Pepa'


@pytest.mark.parametrize('name', ['', 'A', 'x' * 21])
def test_pet_name_is_validated(api, name):
    response = api.patch(RACHA, {'mascota_nombre': name}, format='json')

    assert response.status_code == 400 and response.json()['code'] == 'validation_error'


def test_streak_endpoints_require_authentication(anon):
    assert anon.get(RACHA).status_code == 401
