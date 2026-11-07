import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from accounts import otp as otp_service
from accounts.models import User


@pytest.fixture(autouse=True)
def clear_cache():
    """Reinicia los contadores de throttling entre tests."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def register_payload():
    return {'nombre': 'Ana', 'apellido': 'Pérez', 'email': 'Ana@Flora.cl', 'password': 'Clave1234'}


@pytest.fixture
def active_user(db):
    return User.objects.create_user(
        email='luis@flora.cl', password='Clave1234', nombre='Luis', apellido='Soto'
    )


@pytest.fixture
def fixed_codes(monkeypatch):
    """Códigos OTP predecibles: 111111, 222222, ..."""
    sequence = iter(['111111', '222222', '333333', '444444', '555555', '666666'])
    monkeypatch.setattr(otp_service, 'generate_code', lambda: next(sequence))
