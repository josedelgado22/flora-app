"""Identificación SIMULADA (sin clave de Pl@ntNet). Determinista: la misma foto da el mismo resultado."""
import hashlib

from .catalog import load_catalog

SCORES = (0.93, 0.64, 0.41)


def simulated_results(image_bytes):
    catalog = load_catalog()
    start = int.from_bytes(hashlib.sha256(image_bytes).digest()[:4], 'big') % len(catalog)
    return [
        {
            'score': score,
            'scientific_name': catalog[(start + offset) % len(catalog)]['nombre_cientifico'],
            'common_names': [],
            'family': None,
        }
        for offset, score in enumerate(SCORES)
    ]
