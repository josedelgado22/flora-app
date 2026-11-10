import pytest

@pytest.fixture(autouse=True)
def disable_ssl_redirect_for_tests(settings):
    """Sobrescribe en memoria el forzado HTTPS durante la ejecución de PyTest."""
    settings.SECURE_SSL_REDIRECT = False
    settings.SESSION_COOKIE_SECURE = False
    settings.CSRF_COOKIE_SECURE = False