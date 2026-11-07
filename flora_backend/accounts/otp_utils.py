"""Utilidades OTP puras (sin Django): fáciles de probar y de reutilizar."""
import hashlib
import hmac
import secrets

OTP_LENGTH = 6


def generate_code(length=OTP_LENGTH):
    """Código numérico de `length` dígitos con generador criptográfico (admite ceros a la izquierda)."""
    return f'{secrets.randbelow(10 ** length):0{length}d}'


def hash_code(code, challenge_id, secret):
    """HMAC-SHA256 del código ligado al desafío: el mismo código en otro desafío da otro resumen."""
    message = f'{challenge_id}:{code}'.encode('utf-8')
    return hmac.new(secret.encode('utf-8'), message, hashlib.sha256).hexdigest()


def codes_match(stored_digest, code, challenge_id, secret):
    """Comparación en tiempo constante."""
    return hmac.compare_digest(stored_digest, hash_code(code, challenge_id, secret))


def mask_email(email):
    """ana@flora.cl -> a**@flora.cl (igual que la app móvil)."""
    user, _, domain = email.partition('@')
    return f"{user[:1]}{'*' * max(len(user) - 1, 2)}@{domain}"
