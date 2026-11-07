"""Catálogo botánico local y armado de candidatos. Puro (sin Django)."""
import json
import re
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent / 'data' / 'species.json'
_cache = None


def load_catalog():
    global _cache
    if _cache is None:
        with open(DATA_FILE, encoding='utf-8') as handle:
            _cache = json.load(handle)
    return _cache


def normalize_name(name):
    """'Aloe vera (L.) Burm.f.' -> 'aloe vera' (género + especie, minúsculas, sin autores)."""
    return ' '.join((name or '').replace('×', ' ').lower().split()[:2])


def find_species(scientific_name):
    key = normalize_name(scientific_name)
    if not key:
        return None
    for species in load_catalog():
        names = [species['nombre_cientifico'], *species.get('aliases', [])]
        if key in {normalize_name(name) for name in names}:
            return species
    return None


def clamp_percent(score):
    return max(0, min(100, round(float(score) * 100)))


def _public(species):
    return {key: value for key, value in species.items() if key != 'aliases'}


def _slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', normalize_name(name)).strip('-')


def estimated_species(item):
    """Especie fuera del catálogo: valores generales y marcados como estimados."""
    common = item['common_names'][0] if item.get('common_names') else item['scientific_name']
    return {
        'id': _slugify(item['scientific_name']),
        'nombre_comun': common,
        'nombre_cientifico': item['scientific_name'],
        'categoria': None,
        'habito': None,
        'nivel_luz_ideal': 'media',
        'ubicacion_ideal': 'ambas',
        'frecuencia_riego_dias': 7,
        'temperatura': 'No disponible',
        'consejos': ['Esta especie no está en nuestro catálogo: usa cuidados generales y observa cómo responde.'],
    }


def build_candidates(raw_results, limit=3):
    """Resultados crudos (parsing.parse_response) -> candidatos con el formato que espera la app."""
    seen = {}
    for item in sorted(raw_results, key=lambda r: r['score'], reverse=True):
        species = find_species(item['scientific_name'])
        if species:
            candidate = {**_public(species), 'en_catalogo': True, 'datos_estimados': False}
        else:
            candidate = {**estimated_species(item), 'en_catalogo': False, 'datos_estimados': True}
        candidate['coincidencia'] = clamp_percent(item['score'])
        seen.setdefault(candidate['id'], candidate)  # ya vienen de mayor a menor puntaje
    return list(seen.values())[:limit]
