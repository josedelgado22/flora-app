import pytest

from plants.models import Plant, PlantCategory

pytestmark = pytest.mark.django_db

URL = '/api/v1/plantas/'

VALID = {
    'nombre_comun': 'Lavanda',
    'nombre_cientifico': 'Lavandula angustifolia',
    'categoria': 'Aromática',
    'especie_slug': 'lavandula-angustifolia',
    'nivel_luz': 'alta',
    'ubicacion': 'exterior',
    'frecuencia_base_dias': 5,
}


def test_requires_authentication(anon):
    assert anon.get(URL).status_code == 401
    assert anon.post(URL, VALID, format='json').status_code == 401


def test_create_returns_201_with_the_fields_the_app_expects(api, user):
    response = api.post(URL, VALID, format='json')

    assert response.status_code == 201
    body = response.json()
    assert body['nombre_comun'] == 'Lavanda'
    assert body['categoria'] == 'Aromática'
    assert body['frecuencia_base_dias'] == 5
    assert body['frecuencia_riego_dias'] == 4  # 5 * 0.8 (luz alta)
    assert body['ultimo_riego'] is None and body['foto_url'] is None
    assert 'client_local_id' not in body and 'user' not in body
    assert Plant.objects.get(pk=body['id']).user == user


def test_list_returns_a_plain_array_with_only_my_plants(api, plant, other_plant):
    response = api.get(URL)

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert [p['id'] for p in body] == [plant.id]


def test_list_is_ordered_by_name(api, user):
    for name in ('Zamioculca', 'Aloe', 'Monstera'):
        Plant.objects.create(user=user, nombre_comun=name)

    assert [p['nombre_comun'] for p in api.get(URL).json()] == ['Aloe', 'Monstera', 'Zamioculca']


def test_plants_of_other_users_are_invisible(api, other_plant):
    assert api.get(f'{URL}{other_plant.id}/').status_code == 404
    assert api.patch(f'{URL}{other_plant.id}/', {'nombre_comun': 'X'}, format='json').status_code == 404
    assert api.delete(f'{URL}{other_plant.id}/').status_code == 404
    assert Plant.objects.filter(pk=other_plant.id).exists()


@pytest.mark.parametrize(
    'field,value',
    [
        ('nombre_comun', ''),
        ('nivel_luz', 'extrema'),
        ('ubicacion', 'balcon'),
        ('frecuencia_base_dias', 0),
        ('frecuencia_base_dias', 366),
        ('categoria', 'No existe'),
    ],
)
def test_create_validates_input(api, field, value):
    response = api.post(URL, {**VALID, field: value}, format='json')

    assert response.status_code == 400
    assert response.json()['code'] == 'validation_error'
    assert field in response.json()['errors']
    assert Plant.objects.count() == 0


def test_create_requires_a_name(api):
    response = api.post(URL, {}, format='json')

    assert response.status_code == 400 and 'nombre_comun' in response.json()['errors']


def test_patching_the_light_changes_the_effective_frequency(api, plant):
    assert api.get(f'{URL}{plant.id}/').json()['frecuencia_riego_dias'] == 7

    response = api.patch(f'{URL}{plant.id}/', {'nivel_luz': 'baja'}, format='json')

    assert response.status_code == 200
    assert response.json()['frecuencia_riego_dias'] == 9
    assert response.json()['frecuencia_base_dias'] == 7


def test_delete_returns_204_and_removes_the_plant(api, plant):
    assert api.delete(f'{URL}{plant.id}/').status_code == 204
    assert api.get(f'{URL}{plant.id}/').status_code == 404


def test_creating_twice_with_the_same_local_id_returns_the_same_plant(api):
    first = api.post(URL, {**VALID, 'client_local_id': -1700000000000001}, format='json')
    second = api.post(URL, {**VALID, 'client_local_id': -1700000000000001}, format='json')

    assert first.status_code == 201 and second.status_code == 200
    assert first.json()['id'] == second.json()['id']
    assert Plant.objects.count() == 1


def test_photo_url_comes_from_the_latest_plant_photo(api, plant):
    from plants.models import FotoPlanta
    from plants.tests.helpers import at_noon

    FotoPlanta.objects.create(planta=plant, url='https://cdn/vieja.jpg', tomada_en=at_noon(5))
    FotoPlanta.objects.create(planta=plant, url='https://cdn/nueva.jpg', tomada_en=at_noon(1))
    FotoPlanta.objects.create(planta=plant, tipo='lugar', url='https://cdn/lugar.jpg', tomada_en=at_noon(0))

    assert api.get(f'{URL}{plant.id}/').json()['foto_url'] == 'https://cdn/nueva.jpg'


def test_categories_exist_for_creating_plants():
    assert PlantCategory.objects.filter(nombre='Aromática').exists()
