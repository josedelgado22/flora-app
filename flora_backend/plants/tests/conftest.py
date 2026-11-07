import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.models import User
from plants.models import Plant, PlantCategory


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def user(db):
    return User.objects.create_user(email='ana@flora.cl', password='Clave1234', nombre='Ana', apellido='Pérez')


@pytest.fixture
def other_user(db):
    return User.objects.create_user(email='luis@flora.cl', password='Clave1234', nombre='Luis', apellido='Soto')


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def other_api(other_user):
    client = APIClient()
    client.force_authenticate(user=other_user)
    return client


@pytest.fixture
def anon():
    return APIClient()


@pytest.fixture
def plant(user):
    return Plant.objects.create(
        user=user,
        nombre_comun='Monstera',
        nombre_cientifico='Monstera deliciosa',
        categoria=PlantCategory.objects.get(nombre='Tropical'),
        nivel_luz='media',
        ubicacion='interior',
        frecuencia_base_dias=7,
    )


@pytest.fixture
def other_plant(other_user):
    return Plant.objects.create(user=other_user, nombre_comun='Potus', frecuencia_base_dias=6)
