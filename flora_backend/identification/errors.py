"""Errores de identificación. 502/503/504 hacen que la app salte al cuestionario manual (SC-01)."""
from accounts.exceptions import APIError


def ai_timeout():
    return APIError('La IA no respondió a tiempo. Usa el cuestionario manual.', 'ai_timeout', 504)


def ai_unavailable():
    return APIError('El servicio de identificación no está disponible.', 'ai_unavailable', 502)


def ai_quota():
    return APIError('Se alcanzó el límite de identificaciones. Inténtalo más tarde.', 'ai_quota', 503)


def image_too_large():
    return APIError('La foto supera el tamaño permitido. Comprímela antes de enviarla.', 'image_too_large', 413)


def invalid_image():
    return APIError('El archivo no es una imagen JPEG o PNG válida.', 'invalid_image', 400)
