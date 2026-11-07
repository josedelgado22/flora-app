"""Login con doble factor: POST /auth/login/, /2fa/verify/, /2fa/resend/, refresh y /me/."""
import uuid

import jwt
import pytest
from django.core import mail
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import OTPCode
from accounts.tests.helpers import (
    LOGIN,
    ME,
    REFRESH,
    REGISTER,
    REGISTER_VERIFY,
    TWO_FA_RESEND,
    TWO_FA_VERIFY,
    age_otp,
    last_code,
    post,
    wrong_code,
)

pytestmark = pytest.mark.django_db

CREDENTIALS = {'email': 'luis@flora.cl', 'password': 'Clave1234'}


def start_login(api):
    response = post(api, LOGIN, CREDENTIALS)
    assert response.status_code == 200, response.content
    return response.json()


# ---------------------------------------------------------------- POST /login/ (401)
def test_login_wrong_password_returns_401(api, active_user):
    response = post(api, LOGIN, {**CREDENTIALS, 'password': 'Incorrecta1'})

    assert response.status_code == 401
    assert response.json() == {'code': 'invalid_credentials', 'detail': 'Correo o contraseña incorrectos.'}


def test_login_unknown_user_gets_the_same_401_as_wrong_password(api, active_user):
    wrong_password = post(api, LOGIN, {**CREDENTIALS, 'password': 'Incorrecta1'})
    unknown_user = post(api, LOGIN, {'email': 'nadie@flora.cl', 'password': 'Clave1234'})

    assert unknown_user.status_code == 401
    assert unknown_user.json() == wrong_password.json()  # no revela si el correo existe


def test_login_requires_both_fields(api):
    response = post(api, LOGIN, {})

    assert response.status_code == 400
    assert response.json()['code'] == 'validation_error'


# ---------------------------------------------------------------- POST /login/ (2FA)
def test_login_with_2fa_returns_challenge_and_sends_email(api, active_user):
    body = start_login(api)

    assert body['requires_2fa'] is True
    assert body['method'] == 'email'
    assert body['expires_in'] == 300
    assert body['email_hint'] == 'l***@flora.cl'
    uuid.UUID(body['challenge_id'])
    assert 'access' not in body

    assert OTPCode.objects.get(challenge_id=body['challenge_id']).purpose == 'login'
    assert len(mail.outbox) == 1 and mail.outbox[0].to == ['luis@flora.cl']


def test_login_email_is_case_insensitive(api, active_user):
    response = post(api, LOGIN, {'email': ' LUIS@Flora.CL ', 'password': 'Clave1234'})

    assert response.status_code == 200
    assert response.json()['requires_2fa'] is True


def test_login_without_2fa_when_disabled_globally(api, active_user, settings):
    settings.TWO_FACTOR_REQUIRED = False

    response = post(api, LOGIN, CREDENTIALS)

    assert response.status_code == 200
    assert response.json()['access'] and response.json()['refresh']
    assert mail.outbox == []


def test_login_without_2fa_when_disabled_for_the_user(api, active_user):
    active_user.two_factor_enabled = False
    active_user.save(update_fields=['two_factor_enabled'])

    response = post(api, LOGIN, CREDENTIALS)

    assert response.status_code == 200
    assert 'access' in response.json() and mail.outbox == []


# ---------------------------------------------------------------- POST /2fa/verify/
def test_2fa_verify_issues_valid_jwt(api, active_user):
    challenge = start_login(api)['challenge_id']

    response = post(api, TWO_FA_VERIFY, {'challenge_id': challenge, 'code': last_code()})

    assert response.status_code == 200
    body = response.json()
    assert body['user']['email'] == 'luis@flora.cl'
    assert jwt.get_unverified_header(body['access'])['alg'] == 'HS256'
    assert str(AccessToken(body['access'])['user_id']) == str(active_user.id)

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")
    me = api.get(ME)
    assert me.status_code == 200 and me.json()['email'] == 'luis@flora.cl'


def test_2fa_verify_wrong_code_returns_400(api, active_user):
    challenge = start_login(api)['challenge_id']

    response = post(api, TWO_FA_VERIFY, {'challenge_id': challenge, 'code': wrong_code(last_code())})

    assert response.status_code == 400
    assert response.json()['code'] == 'invalid_code'


def test_2fa_verify_expired_code_returns_400(api, active_user):
    challenge = start_login(api)['challenge_id']
    code = last_code()
    age_otp(challenge, 301)

    response = post(api, TWO_FA_VERIFY, {'challenge_id': challenge, 'code': code})

    assert response.status_code == 400
    assert response.json()['code'] == 'challenge_expired'


def test_2fa_code_is_single_use(api, active_user):
    challenge = start_login(api)['challenge_id']
    code = last_code()

    assert post(api, TWO_FA_VERIFY, {'challenge_id': challenge, 'code': code}).status_code == 200
    again = post(api, TWO_FA_VERIFY, {'challenge_id': challenge, 'code': code})

    assert again.status_code == 400 and again.json()['code'] == 'challenge_expired'


def test_a_new_login_invalidates_the_previous_challenge(api, active_user):
    first = start_login(api)['challenge_id']
    first_code = last_code()
    start_login(api)

    response = post(api, TWO_FA_VERIFY, {'challenge_id': first, 'code': first_code})

    assert response.status_code == 400 and response.json()['code'] == 'challenge_expired'


def test_registration_challenge_cannot_be_used_as_login_2fa(api, register_payload):
    challenge = post(api, REGISTER, register_payload).json()['challenge_id']

    response = post(api, TWO_FA_VERIFY, {'challenge_id': challenge, 'code': last_code()})

    assert response.status_code == 400
    assert response.json()['code'] == 'challenge_expired'


def test_login_challenge_cannot_activate_a_registration(api, active_user):
    challenge = start_login(api)['challenge_id']

    response = post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': last_code()})

    assert response.status_code == 400
    assert response.json()['code'] == 'challenge_expired'


def test_full_flow_register_verify_then_login_with_2fa(api, register_payload):
    challenge = post(api, REGISTER, register_payload).json()['challenge_id']
    assert post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': last_code()}).status_code == 200

    login = post(api, LOGIN, {'email': 'ana@flora.cl', 'password': 'Clave1234'})
    assert login.status_code == 200 and login.json()['requires_2fa'] is True

    session = post(api, TWO_FA_VERIFY, {'challenge_id': login.json()['challenge_id'], 'code': last_code()})
    assert session.status_code == 200 and session.json()['user']['nombre'] == 'Ana'


# ---------------------------------------------------------------- POST /2fa/resend/
def test_2fa_resend_sends_a_new_code(api, active_user, fixed_codes):
    challenge = start_login(api)['challenge_id']
    age_otp(challenge, 31)

    response = post(api, TWO_FA_RESEND, {'challenge_id': challenge})

    assert response.status_code == 200 and response.json() == {'expires_in': 300}
    assert len(mail.outbox) == 2 and last_code() == '222222'
    assert post(api, TWO_FA_VERIFY, {'challenge_id': challenge, 'code': '222222'}).status_code == 200


def test_2fa_resend_cooldown_returns_429(api, active_user):
    challenge = start_login(api)['challenge_id']

    response = post(api, TWO_FA_RESEND, {'challenge_id': challenge})

    assert response.status_code == 429 and response.json()['code'] == 'resend_too_soon'


def test_2fa_resend_unknown_challenge_returns_400(api):
    response = post(api, TWO_FA_RESEND, {'challenge_id': str(uuid.uuid4())})

    assert response.status_code == 400 and response.json()['code'] == 'challenge_expired'


# ---------------------------------------------------------------- refresh y /me/
def test_token_refresh_returns_a_new_access_token(api, active_user, settings):
    settings.TWO_FACTOR_REQUIRED = False
    refresh = post(api, LOGIN, CREDENTIALS).json()['refresh']

    response = post(api, REFRESH, {'refresh': refresh})

    assert response.status_code == 200 and response.json()['access']


def test_token_refresh_rejects_an_invalid_token_with_401(api):
    response = post(api, REFRESH, {'refresh': 'token.invalido.xxx'})

    assert response.status_code == 401
    assert 'code' in response.json() and 'detail' in response.json()


def test_me_requires_authentication(api):
    response = api.get(ME)

    assert response.status_code == 401
    assert response.json()['code'] == 'not_authenticated'


def test_me_rejects_a_bad_token(api):
    api.credentials(HTTP_AUTHORIZATION='Bearer no-es-un-token')

    response = api.get(ME)

    assert response.status_code == 401
    assert response.json()['code'] == 'authentication_failed'


# ---------------------------------------------------------------- límites y salud
def test_auth_endpoints_are_rate_limited(api, active_user, monkeypatch):
    monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {'auth': '2/min'})
    bad = {'email': 'nadie@flora.cl', 'password': 'Clave1234'}

    assert post(api, LOGIN, bad).status_code == 401
    assert post(api, LOGIN, bad).status_code == 401
    third = post(api, LOGIN, bad)

    assert third.status_code == 429
    assert third.json()['code'] == 'throttled'


def test_health_endpoint(api):
    response = api.get('/api/v1/health/')

    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}
