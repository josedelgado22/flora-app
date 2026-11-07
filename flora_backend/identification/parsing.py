"""Interpreta la respuesta de Pl@ntNet. Puro (sin Django ni red)."""


def parse_response(payload):
    """
    Pl@ntNet v2 -> [{'score', 'scientific_name', 'common_names', 'family'}].
    Formato esperado: {'results': [{'score': 0.93, 'species': {'scientificNameWithoutAuthor': ...,
                                    'commonNames': [...], 'family': {'scientificNameWithoutAuthor': ...}}}]}
    Se ignoran los resultados sin nombre científico.
    """
    parsed = []
    for item in (payload or {}).get('results') or []:
        species = item.get('species') or {}
        name = species.get('scientificNameWithoutAuthor') or species.get('scientificName')
        if not name:
            continue
        try:
            score = float(item.get('score') or 0)
        except (TypeError, ValueError):
            score = 0.0
        family = species.get('family') or {}
        parsed.append(
            {
                'score': score,
                'scientific_name': str(name).strip(),
                'common_names': [str(n) for n in species.get('commonNames') or []],
                'family': family.get('scientificNameWithoutAuthor') or family.get('scientificName'),
            }
        )
    return parsed
