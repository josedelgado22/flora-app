"""Registro con verificación de correo: POST /auth/register/, /verify/ y /resend/."""
import smtplib
import uuid

import pytest
from django.core import mail
from django.core.mail import EmailMultiAlternatives

from accounts.models import OTPCode, User
from accounts.tests.helpers import (
    ME,
    LOGIN,
    REGISTER,
    REGISTER_RESEND,
    REGISTER_VERIFY,
    age_otp,
    last_code,
    post,
    wrong_code,
)

pytestmark = pytest.mark.django_db


def do_register(api, payload):
    response = post(api, REGISTER, payload)
    assert response.status_code == 202, response.content
    return response.json()


# ---------------------------------------------------------------- POST /register/
def test_register_returns_202_with_challenge_and_sends_email(api, register_payload):
    response = post(api, REGISTER, register_payload)

    assert response.status_code == 202
    body = response.json()
    assert body['requires_verification'] is True
    assert body['method'] == 'email'
    assert body['expires_in'] == 300
    assert body['email_hint'] == 'a**@flora.cl'
    uuid.UUID(body['challenge_id'])

    user = User.objects.get(email='ana@flora.cl')  # el correo se normaliza a minúsculas
    assert user.is_active is False
    assert user.check_password('Clave1234')
    assert (user.nombre, user.apellido) == ('Ana', 'Pérez')

    otp = OTPCode.objects.get(challenge_id=body['challenge_id'])
    assert otp.purpose == 'register' and otp.is_used is False

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ['ana@flora.cl']
    assert len(last_code()) == 6


@pytest.mark.parametrize(
    'field,value',
    [
        ('email', 'no-es-un-correo'),
        ('password', 'corta1'),
        ('password', 'sololetrasaaa'),
        ('password', '1234567890'),
        ('nombre', 'A'),
        ('apellido', ''),
    ],
)
def test_register_rejects_invalid_data_with_400(api, register_payload, field, value):
    register_payload[field] = value

    response = post(api, REGISTER, register_payload)

    assert response.status_code == 400
    body = response.json()
    assert body['code'] == 'validation_error'
    assert field in body['errors']
    assert User.objects.count() == 0
    assert mail.outbox == []


def test_register_requires_all_fields(api):
    response = post(api, REGISTER, {})

    assert response.status_code == 400
    assert set(response.json()['errors']) == {'nombre', 'apellido', 'email', 'password'}


def test_register_existing_active_email_returns_409(api, active_user, register_payload):
    register_payload['email'] = 'LUIS@flora.cl'

    response = post(api, REGISTER, register_payload)

    assert response.status_code == 409
    assert response.json()['code'] == 'email_exists'
    assert mail.outbox == []


def test_registering_a_pending_email_replaces_the_previous_code(api, register_payload):
    first = do_register(api, register_payload)
    register_payload.update(nombre='Ana María', password='Otra12345')
    second = do_register(api, register_payload)

    assert first['challenge_id'] != second['challenge_id']
    assert User.objects.count() == 1
    assert User.objects.get().check_password('Otra12345')
    assert len(mail.outbox) == 2

    old = post(api, REGISTER_VERIFY, {'challenge_id': first['challenge_id'], 'code': '123456'})
    assert old.status_code == 400 and old.json()['code'] == 'challenge_expired'


def test_email_failure_returns_503_and_leaves_nothing_saved(api, register_payload, monkeypatch):
    def boom(self, fail_silently=False):
        raise smtplib.SMTPException('SMTP caído')

    monkeypatch.setattr(EmailMultiAlternatives, 'send', boom)

    response = post(api, REGISTER, register_payload)

    assert response.status_code == 503
    assert response.json()['code'] == 'email_send_failed'
    assert User.objects.count() == 0
    assert OTPCode.objects.count() == 0


# ---------------------------------------------------------------- POST /register/verify/
def test_verify_activates_account_and_returns_session(api, register_payload):
    challenge = do_register(api, register_payload)['challenge_id']

    response = post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': last_code()})

    assert response.status_code == 200
    body = response.json()
    assert body['access'] and body['refresh']
    assert body['user']['email'] == 'ana@flora.cl'
    assert set(body['user']) == {'id', 'email', 'nombre', 'apellido', 'fecha_registro'}
    assert User.objects.get(email='ana@flora.cl').is_active is True

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {body['access']}")
    assert api.get(ME).status_code == 200


def test_verify_wrong_code_returns_400_and_keeps_account_inactive(api, register_payload):
    challenge = do_register(api, register_payload)['challenge_id']

    response = post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': wrong_code(last_code())})

    assert response.status_code == 400
    assert response.json()['code'] == 'invalid_code'
    assert User.objects.get().is_active is False


def test_verify_expired_code_returns_400(api, register_payload):
    challenge = do_register(api, register_payload)['challenge_id']
    code = last_code()
    age_otp(challenge, 301)

    response = post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': code})

    assert response.status_code == 400
    assert response.json()['code'] == 'challenge_expired'
    assert User.objects.get().is_active is False


def test_verify_code_is_single_use(api, register_payload):
    challenge = do_register(api, register_payload)['challenge_id']
    code = last_code()

    assert post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': code}).status_code == 200
    again = post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': code})

    assert again.status_code == 400
    assert again.json()['code'] == 'challenge_expired'


def test_verify_locks_after_five_wrong_attempts(api, register_payload):
    challenge = do_register(api, register_payload)['challenge_id']
    code = last_code()

    for _ in range(5):
        post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': wrong_code(code)})
    response = post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': code})

    assert response.status_code == 400
    assert response.json()['code'] == 'too_many_attempts'
    assert User.objects.get().is_active is False


@pytest.mark.parametrize('payload', [{'code': 'abc'}, {'code': '12345'}, {'challenge_id': 'no-uuid', 'code': '123456'}])
def test_verify_validates_input(api, payload):
    response = post(api, REGISTER_VERIFY, {'challenge_id': str(uuid.uuid4()), **payload})

    assert response.status_code == 400
    assert response.json()['code'] == 'validation_error'


def test_verify_unknown_challenge_returns_400(api):
    response = post(api, REGISTER_VERIFY, {'challenge_id': str(uuid.uuid4()), 'code': '123456'})

    assert response.status_code == 400
    assert response.json()['code'] == 'challenge_expired'


# ---------------------------------------------------------------- login antes de verificar
def test_login_before_verifying_returns_403(api, register_payload):
    do_register(api, register_payload)

    response = post(api, LOGIN, {'email': 'ana@flora.cl', 'password': 'Clave1234'})

    assert response.status_code == 403
    assert response.json()['code'] == 'account_not_verified'


def test_login_before_verifying_with_wrong_password_returns_401(api, register_payload):
    do_register(api, register_payload)

    response = post(api, LOGIN, {'email': 'ana@flora.cl', 'password': 'Incorrecta1'})

    assert response.status_code == 401
    assert response.json()['code'] == 'invalid_credentials'


# ---------------------------------------------------------------- POST /register/resend/
def test_resend_sends_a_new_code_for_the_same_challenge(api, register_payload, fixed_codes):
    challenge = do_register(api, register_payload)['challenge_id']
    assert last_code() == '111111'
    age_otp(challenge, 31)

    response = post(api, REGISTER_RESEND, {'challenge_id': challenge})

    assert response.status_code == 200
    assert response.json() == {'expires_in': 300}
    assert len(mail.outbox) == 2 and last_code() == '222222'

    old = post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': '111111'})
    assert old.status_code == 400 and old.json()['code'] == 'invalid_code'
    new = post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': '222222'})
    assert new.status_code == 200


def test_resend_has_a_cooldown_returning_429(api, register_payload):
    challenge = do_register(api, register_payload)['challenge_id']

    response = post(api, REGISTER_RESEND, {'challenge_id': challenge})

    assert response.status_code == 429
    assert response.json()['code'] == 'resend_too_soon'
    assert len(mail.outbox) == 1


def test_resend_after_expiry_allows_verifying_with_the_new_code(api, register_payload):
    challenge = do_register(api, register_payload)['challenge_id']
    age_otp(challenge, 400)

    assert post(api, REGISTER_RESEND, {'challenge_id': challenge}).status_code == 200
    response = post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': last_code()})

    assert response.status_code == 200


def test_resend_unknown_challenge_returns_400(api):
    response = post(api, REGISTER_RESEND, {'challenge_id': str(uuid.uuid4())})

    assert response.status_code == 400
    assert response.json()['code'] == 'challenge_expired'


def test_resend_email_failure_returns_503_and_keeps_previous_code(api, register_payload, monkeypatch):
    challenge = do_register(api, register_payload)['challenge_id']
    code = last_code()
    age_otp(challenge, 31)

    def boom(self, fail_silently=False):
        raise smtplib.SMTPException('SMTP caído')

    monkeypatch.setattr(EmailMultiAlternatives, 'send', boom)
    response = post(api, REGISTER_RESEND, {'challenge_id': challenge})
    monkeypatch.undo()

    assert response.status_code == 503
    assert post(api, REGISTER_VERIFY, {'challenge_id': challenge, 'code': code}).status_code == 200
