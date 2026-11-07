"""Ciclo de vida del OTP: creación, expiración (5 min), uso único, intentos y reenvío."""
import uuid

import pytest
from django.conf import settings

from accounts import otp as otp_service
from accounts.exceptions import APIError
from accounts.models import OTPCode, User
from accounts.otp_utils import hash_code
from accounts.tests.helpers import age_otp, wrong_code

pytestmark = pytest.mark.django_db

REGISTER = OTPCode.Purpose.REGISTER
LOGIN = OTPCode.Purpose.LOGIN


@pytest.fixture
def user():
    return User.objects.create_user(
        email='ana@flora.cl', password='Clave1234', nombre='Ana', apellido='Pérez', is_active=False
    )


def error_code(excinfo):
    return excinfo.value.get_codes()


# ---------------------------------------------------------------- creación
def test_issue_creates_otp_with_expected_fields(user):
    otp, plain = otp_service.issue_otp(user, REGISTER)

    assert len(plain) == 6 and plain.isdigit()
    assert otp.user_id == user.id
    assert otp.purpose == 'register'
    assert otp.is_used is False
    assert otp.attempts == 0
    assert OTPCode.objects.count() == 1


def test_code_is_stored_as_hmac_not_plaintext(user):
    otp, plain = otp_service.issue_otp(user, REGISTER)
    otp.refresh_from_db()

    assert otp.code != plain
    assert len(otp.code) == 64
    assert otp.code == hash_code(plain, otp.challenge_id, settings.SECRET_KEY)


def test_issue_invalidates_previous_pending_codes(user):
    first, _ = otp_service.issue_otp(user, REGISTER)
    second, _ = otp_service.issue_otp(user, REGISTER)

    first.refresh_from_db()
    assert first.is_used is True
    assert second.is_used is False


def test_issue_does_not_touch_other_purposes(user):
    login_otp, _ = otp_service.issue_otp(user, LOGIN)
    otp_service.issue_otp(user, REGISTER)

    login_otp.refresh_from_db()
    assert login_otp.is_used is False


# ---------------------------------------------------------------- uso único
def test_verify_consumes_the_code(user):
    otp, plain = otp_service.issue_otp(user, REGISTER)

    verified = otp_service.verify_otp(otp.challenge_id, plain, REGISTER)

    assert verified.is_used is True
    assert verified.user_id == user.id


def test_code_cannot_be_used_twice(user):
    otp, plain = otp_service.issue_otp(user, REGISTER)
    otp_service.verify_otp(otp.challenge_id, plain, REGISTER)

    with pytest.raises(APIError) as excinfo:
        otp_service.verify_otp(otp.challenge_id, plain, REGISTER)

    assert error_code(excinfo) == 'challenge_expired'


# ---------------------------------------------------------------- expiración
def test_code_expires_after_five_minutes(user):
    otp, plain = otp_service.issue_otp(user, REGISTER)
    age_otp(otp.challenge_id, 301)

    with pytest.raises(APIError) as excinfo:
        otp_service.verify_otp(otp.challenge_id, plain, REGISTER)

    assert error_code(excinfo) == 'challenge_expired'
    assert excinfo.value.status_code == 400


def test_code_is_valid_just_before_expiring(user):
    otp, plain = otp_service.issue_otp(user, REGISTER)
    age_otp(otp.challenge_id, 299)

    assert otp_service.verify_otp(otp.challenge_id, plain, REGISTER).is_used is True


def test_expiry_follows_the_setting(user, settings):
    settings.OTP_EXPIRY_SECONDS = 60
    otp, plain = otp_service.issue_otp(user, REGISTER)
    age_otp(otp.challenge_id, 61)

    with pytest.raises(APIError):
        otp_service.verify_otp(otp.challenge_id, plain, REGISTER)


# ---------------------------------------------------------------- intentos
def test_wrong_code_counts_attempts_and_is_persisted(user):
    otp, plain = otp_service.issue_otp(user, REGISTER)

    with pytest.raises(APIError) as excinfo:
        otp_service.verify_otp(otp.challenge_id, wrong_code(plain), REGISTER)

    assert error_code(excinfo) == 'invalid_code'
    otp.refresh_from_db()
    assert otp.attempts == 1  # el intento fallido NO se pierde al lanzar el error
    assert otp.is_used is False


def test_challenge_locks_after_max_attempts_even_with_correct_code(user):
    otp, plain = otp_service.issue_otp(user, REGISTER)

    for _ in range(settings.OTP_MAX_ATTEMPTS):
        with pytest.raises(APIError):
            otp_service.verify_otp(otp.challenge_id, wrong_code(plain), REGISTER)

    with pytest.raises(APIError) as excinfo:
        otp_service.verify_otp(otp.challenge_id, plain, REGISTER)

    assert error_code(excinfo) == 'too_many_attempts'


# ---------------------------------------------------------------- propósito / desconocidos
def test_purpose_mismatch_is_rejected(user):
    otp, plain = otp_service.issue_otp(user, LOGIN)

    with pytest.raises(APIError) as excinfo:
        otp_service.verify_otp(otp.challenge_id, plain, REGISTER)

    assert error_code(excinfo) == 'challenge_expired'


def test_unknown_challenge_is_rejected():
    with pytest.raises(APIError) as excinfo:
        otp_service.verify_otp(uuid.uuid4(), '123456', REGISTER)

    assert error_code(excinfo) == 'challenge_expired'


# ---------------------------------------------------------------- reenvío
def test_refresh_keeps_challenge_and_replaces_code(user, fixed_codes):
    otp, first_plain = otp_service.issue_otp(user, REGISTER)
    otp.attempts = 3
    otp.save(update_fields=['attempts'])
    age_otp(otp.challenge_id, 31)

    refreshed, new_plain = otp_service.refresh_otp(otp.challenge_id, REGISTER)

    assert refreshed.challenge_id == otp.challenge_id
    assert first_plain == '111111' and new_plain == '222222'
    assert refreshed.attempts == 0
    assert OTPCode.objects.count() == 1

    with pytest.raises(APIError) as excinfo:  # el código anterior ya no sirve
        otp_service.verify_otp(otp.challenge_id, first_plain, REGISTER)
    assert error_code(excinfo) == 'invalid_code'
    assert otp_service.verify_otp(otp.challenge_id, new_plain, REGISTER).is_used is True


def test_refresh_has_a_cooldown(user):
    otp, _ = otp_service.issue_otp(user, REGISTER)

    with pytest.raises(APIError) as excinfo:
        otp_service.refresh_otp(otp.challenge_id, REGISTER)

    assert error_code(excinfo) == 'resend_too_soon'
    assert excinfo.value.status_code == 429


def test_refresh_works_even_if_the_code_already_expired(user):
    otp, _ = otp_service.issue_otp(user, REGISTER)
    age_otp(otp.challenge_id, 400)

    refreshed, new_plain = otp_service.refresh_otp(otp.challenge_id, REGISTER)

    assert refreshed.is_expired is False
    assert otp_service.verify_otp(otp.challenge_id, new_plain, REGISTER).is_used is True


def test_refresh_of_a_used_challenge_fails(user):
    otp, plain = otp_service.issue_otp(user, REGISTER)
    otp_service.verify_otp(otp.challenge_id, plain, REGISTER)
    age_otp(otp.challenge_id, 60)

    with pytest.raises(APIError) as excinfo:
        otp_service.refresh_otp(otp.challenge_id, REGISTER)

    assert error_code(excinfo) == 'challenge_expired'
