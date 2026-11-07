from datetime import timedelta

import pytest
from django.utils import timezone

from plants.models import Plant, Racha, Riego
from plants.tests.helpers import at_noon

pytestmark = pytest.mark.django_db

URL = '/api/v1/sync/batch/'
LOCAL_ID = -1700000000000001


def op(client_id, tipo, payload, created=None):
    return {
        'client_id': client_id,
        'tipo': tipo,
        'payload': payload,
        'creado_en': (created or timezone.now()).isoformat(),
    }


def new_plant(local_id=LOCAL_ID, **extra):
    return {
        'local_id': local_id,
        'especie_slug': 'lavandula-angustifolia',
        'nombre_comun': 'Lavanda',
        'nombre_cientifico': 'Lavandula angustifolia',
        'categoria': 'Aromática',
        'nivel_luz': 'alta',
        'ubicacion': 'exterior',
        'frecuencia_base_dias': 6,
        'foto_local_uri': 'file:///cache/foto.jpg',
        **extra,
    }


def send(api, operations):
    return api.post(URL, {'operaciones': operations}, format='json')


def test_requires_authentication(anon):
    assert send(anon, []).status_code == 401


def test_empty_batch_is_fine(api):
    response = send(api, [])

    assert response.status_code == 200
    assert response.json() == {'procesadas': [], 'rechazadas': [], 'mapeo_plantas': []}


def test_new_plant_is_created_and_mapped_to_its_server_id(api, user):
    response = send(api, [op(1, 'planta_nueva', new_plant())])

    assert response.status_code == 200
    body = response.json()
    plant = Plant.objects.get(user=user)
    assert body['procesadas'] == [1] and body['rechazadas'] == []
    assert body['mapeo_plantas'] == [{'local_id': LOCAL_ID, 'server_id': plant.id}]
    assert plant.client_local_id == LOCAL_ID
    assert plant.frecuencia_base_dias == 6 and plant.frecuencia_ajustada_dias == 5  # 6 * 0.8 = 4.8 -> 5
    assert plant.categoria.nombre == 'Aromática'


def test_resending_the_same_batch_does_not_duplicate_anything(api):
    created = timezone.now() - timedelta(seconds=10)
    batch = [
        op(1, 'planta_nueva', new_plant(), created),
        op(2, 'riego', {'planta_id': LOCAL_ID, 'regado_en': at_noon(1).isoformat()}, created + timedelta(seconds=1)),
    ]

    first = send(api, batch).json()
    second = send(api, batch).json()

    assert Plant.objects.count() == 1 and Riego.objects.count() == 1
    assert second['procesadas'] == [1, 2]
    assert second['mapeo_plantas'] == first['mapeo_plantas']


def test_waterings_can_reference_a_plant_created_offline_even_if_listed_first(api, user):
    now = timezone.now()
    batch = [  # el riego viene primero en la lista pero se creó después
        op(2, 'riego', {'planta_id': LOCAL_ID, 'regado_en': at_noon(1).isoformat()}, now - timedelta(seconds=5)),
        op(1, 'planta_nueva', new_plant(), now - timedelta(seconds=10)),
    ]

    body = send(api, batch).json()

    assert body['rechazadas'] == [] and sorted(body['procesadas']) == [1, 2]
    plant = Plant.objects.get(user=user)
    assert plant.ultimo_riego is not None and Riego.objects.filter(planta=plant).count() == 1


def test_watering_with_a_server_id(api, plant):
    body = send(api, [op(1, 'riego', {'planta_id': plant.id, 'regado_en': at_noon(2).isoformat()})]).json()

    assert body['procesadas'] == [1]
    plant.refresh_from_db()
    assert plant.ultimo_riego == at_noon(2)


def test_waterings_offline_build_the_streak_in_chronological_order(api, plant, user):
    batch = [
        op(2, 'riego', {'planta_id': plant.id, 'regado_en': at_noon(1).isoformat()}, at_noon(1)),
        op(1, 'riego', {'planta_id': plant.id, 'regado_en': at_noon(2).isoformat()}, at_noon(2)),
    ]

    send(api, batch)

    racha = Racha.objects.get(user=user)
    assert racha.racha_actual == 2 and racha.mejor_racha == 2


def test_cannot_water_a_plant_of_another_user(api, other_plant):
    body = send(api, [op(1, 'riego', {'planta_id': other_plant.id, 'regado_en': at_noon(1).isoformat()})]).json()

    assert body['procesadas'] == []
    assert body['rechazadas'] == [{'client_id': 1, 'motivo': 'planta_no_encontrada'}]
    assert Riego.objects.count() == 0


def test_unknown_operation_type_is_rejected_without_affecting_the_others(api, user):
    body = send(api, [op(1, 'tipo_raro', {}), op(2, 'planta_nueva', new_plant())]).json()

    assert body['rechazadas'] == [{'client_id': 1, 'motivo': 'tipo_desconocido'}]
    assert body['procesadas'] == [2] and Plant.objects.filter(user=user).count() == 1


def test_invalid_payloads_are_rejected_with_a_reason(api):
    body = send(
        api,
        [
            op(1, 'riego', {'regado_en': at_noon(1).isoformat()}),                  # falta planta_id
            op(2, 'planta_nueva', new_plant(nombre_comun='')),                      # nombre vacío
            op(3, 'planta_nueva', new_plant(local_id=-2, frecuencia_base_dias=999)),  # fuera de rango
        ],
    ).json()

    assert body['procesadas'] == []
    assert [r['client_id'] for r in body['rechazadas']] == [1, 2, 3]
    assert all(r['motivo'].startswith('payload_invalido') for r in body['rechazadas'])
    assert Plant.objects.count() == 0


def test_future_waterings_are_rejected(api, plant):
    future = (timezone.now() + timedelta(days=2)).isoformat()

    body = send(api, [op(1, 'riego', {'planta_id': plant.id, 'regado_en': future})]).json()

    assert body['rechazadas'] == [{'client_id': 1, 'motivo': 'fecha_futura'}]
    assert Riego.objects.count() == 0


def test_unknown_category_is_ignored_instead_of_rejecting_the_plant(api, user):
    body = send(api, [op(1, 'planta_nueva', new_plant(categoria='Categoría inventada'))]).json()

    assert body['procesadas'] == [1]
    assert Plant.objects.get(user=user).categoria is None


def test_null_values_fall_back_to_defaults(api, user):
    body = send(api, [op(1, 'planta_nueva', new_plant(frecuencia_base_dias=None, nivel_luz=None))]).json()

    assert body['procesadas'] == [1]
    assert Plant.objects.get(user=user).frecuencia_base_dias == 7


def test_the_same_local_id_for_two_users_creates_two_plants(api, other_api, user, other_user):
    send(api, [op(1, 'planta_nueva', new_plant())])
    send(other_api, [op(1, 'planta_nueva', new_plant())])

    assert Plant.objects.filter(user=user).count() == 1 and Plant.objects.filter(user=other_user).count() == 1


def test_batch_size_is_limited(api):
    response = send(api, [op(i, 'riego', {}) for i in range(201)])

    assert response.status_code == 400
    assert response.json()['code'] == 'validation_error'


def test_malformed_body_returns_400(api):
    assert api.post(URL, {}, format='json').status_code == 400
    assert api.post(URL, {'operaciones': [{'tipo': 'riego'}]}, format='json').status_code == 400


def test_an_unexpected_error_in_one_operation_does_not_break_the_batch(api, user, monkeypatch):
    from plants import sync

    original = sync.handle_planta_nueva

    def flaky(user_, payload):
        if payload['nombre_comun'] == 'Boom':
            raise RuntimeError('fallo inesperado')
        return original(user_, payload)

    monkeypatch.setitem(sync.HANDLERS, 'planta_nueva', flaky)
    now = timezone.now()

    body = send(
        api,
        [
            op(1, 'planta_nueva', new_plant(-10, nombre_comun='Boom'), now - timedelta(seconds=3)),
            op(2, 'planta_nueva', new_plant(-11, nombre_comun='Bien'), now - timedelta(seconds=2)),
        ],
    ).json()

    assert body['rechazadas'] == [{'client_id': 1, 'motivo': 'error_interno'}]
    assert body['procesadas'] == [2]
    assert list(Plant.objects.filter(user=user).values_list('nombre_comun', flat=True)) == ['Bien']
