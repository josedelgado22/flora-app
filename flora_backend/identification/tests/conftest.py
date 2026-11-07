import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api(db):
    user = User.objects.create_user(email='ana@flora.cl', password='Clave1234', nombre='Ana', apellido='Pérez')
    client = APIClient()
    client.force_authenticate(user=user)
    return client
