"""Pruebas de las utilidades puras del OTP (no usan base de datos)."""
import uuid

from accounts.otp_utils import codes_match, generate_code, hash_code, mask_email


def test_generate_code_is_always_six_digits():
    for _ in range(500):
        code = generate_code()
        assert len(code) == 6
        assert code.isdigit()


def test_generate_code_is_not_constant():
    assert len({generate_code() for _ in range(50)}) > 1


def test_hash_is_bound_to_the_challenge():
    first, second = uuid.uuid4(), uuid.uuid4()
    assert hash_code('123456', first, 'secret') == hash_code('123456', first, 'secret')
    assert hash_code('123456', first, 'secret') != hash_code('123456', second, 'secret')
    assert hash_code('123456', first, 'secret') != hash_code('123456', first, 'other-secret')


def test_codes_match():
    challenge = uuid.uuid4()
    digest = hash_code('123456', challenge, 'secret')
    assert codes_match(digest, '123456', challenge, 'secret')
    assert not codes_match(digest, '654321', challenge, 'secret')


def test_mask_email_matches_mobile_app():
    assert mask_email('ana@flora.cl') == 'a**@flora.cl'
    assert mask_email('demo@flora.cl') == 'd***@flora.cl'
    assert mask_email('a@flora.cl') == 'a**@flora.cl'
