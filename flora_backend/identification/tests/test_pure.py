"""Lógica pura de identificación (sin Django ni red)."""
from identification.catalog import (
    build_candidates,
    clamp_percent,
    find_species,
    load_catalog,
    normalize_name,
)
from identification.imaging import sniff_image
from identification.parsing import parse_response
from identification.simulated import SCORES, simulated_results


def raw(name, score, common=None):
    return {'score': score, 'scientific_name': name, 'common_names': common or [], 'family': None}


def test_catalog_is_consistent():
    catalog = load_catalog()
    ids = [s['id'] for s in catalog]
    assert len(ids) == len(set(ids)) == 8
    required = {'id', 'nombre_comun', 'nombre_cientifico', 'categoria', 'nivel_luz_ideal',
                'ubicacion_ideal', 'frecuencia_riego_dias', 'temperatura', 'consejos'}
    for species in catalog:
        assert required <= set(species), species['id']
        assert species['nivel_luz_ideal'] in ('baja', 'media', 'alta')


def test_normalize_name_keeps_genus_and_species_only():
    assert normalize_name('Aloe vera (L.) Burm.f.') == 'aloe vera'
    assert normalize_name('  MONSTERA   deliciosa Liebm. ') == 'monstera deliciosa'
    assert normalize_name('') == '' and normalize_name(None) == ''


def test_find_species_by_name_alias_and_with_author():
    assert find_species('Monstera deliciosa')['id'] == 'monstera-deliciosa'
    assert find_species('monstera DELICIOSA Liebm.')['id'] == 'monstera-deliciosa'
    assert find_species('Sansevieria trifasciata')['id'] == 'sansevieria-trifasciata'   # sinónimo
    assert find_species('Dracaena trifasciata')['id'] == 'sansevieria-trifasciata'
    assert find_species('Scindapsus aureus')['id'] == 'potus'
    assert find_species('Rosa gallica') is None and find_species('') is None


def test_clamp_percent():
    assert [clamp_percent(s) for s in (0.934, 0.5, 1.7, -0.2, 0)] == [93, 50, 100, 0, 0]


def test_build_candidates_orders_by_score_and_marks_the_catalog():
    candidates = build_candidates([raw('Rosa gallica', 0.2, ['Rosa de Castilla']), raw('Monstera deliciosa', 0.91),
                                   raw('Sansevieria trifasciata', 0.5)])
    assert [c['id'] for c in candidates] == ['monstera-deliciosa', 'sansevieria-trifasciata', 'rosa-gallica']
    assert [c['coincidencia'] for c in candidates] == [91, 50, 20]
    assert [c['en_catalogo'] for c in candidates] == [True, True, False]
    assert 'aliases' not in candidates[0]


def test_unknown_species_is_estimated_with_safe_defaults():
    unknown = build_candidates([raw('Rosa gallica', 0.4, ['Rosa de Castilla'])])[0]
    assert unknown['datos_estimados'] is True and unknown['en_catalogo'] is False
    assert unknown['nombre_comun'] == 'Rosa de Castilla' and unknown['id'] == 'rosa-gallica'
    assert unknown['frecuencia_riego_dias'] == 7 and unknown['nivel_luz_ideal'] == 'media'
    assert unknown['categoria'] is None


def test_build_candidates_dedupes_and_limits():
    same = build_candidates([raw('Monstera deliciosa', 0.9), raw('Monstera deliciosa', 0.3)])
    assert len(same) == 1 and same[0]['coincidencia'] == 90
    many = build_candidates([raw(f'Genus species{i}', 0.9 - i / 100) for i in range(6)])
    assert len(many) == 3 and build_candidates([]) == []


def test_parse_response_reads_the_plantnet_format():
    payload = {'results': [
        {'score': 0.93, 'species': {'scientificNameWithoutAuthor': 'Monstera deliciosa',
                                    'commonNames': ['Costilla de Adán'], 'family': {'scientificNameWithoutAuthor': 'Araceae'}}},
        {'score': '0.4', 'species': {'scientificName': 'Ficus lyrata Warb.'}},
        {'score': 0.1, 'species': {}},          # sin nombre: se ignora
        {'score': None, 'species': {'scientificNameWithoutAuthor': 'Aloe vera'}},
    ]}
    parsed = parse_response(payload)
    assert [p['scientific_name'] for p in parsed] == ['Monstera deliciosa', 'Ficus lyrata Warb.', 'Aloe vera']
    assert parsed[0]['family'] == 'Araceae' and parsed[0]['common_names'] == ['Costilla de Adán']
    assert parsed[1]['score'] == 0.4 and parsed[2]['score'] == 0.0


def test_parse_response_tolerates_garbage():
    assert parse_response({}) == [] and parse_response(None) == [] and parse_response({'results': None}) == []


def test_simulated_results_are_deterministic_and_well_formed():
    first, again, other = simulated_results(b'foto-1'), simulated_results(b'foto-1'), simulated_results(b'foto-2')
    assert first == again
    assert [r['score'] for r in first] == list(SCORES)
    assert len({r['scientific_name'] for r in first}) == 3
    assert all(find_species(r['scientific_name']) for r in first + other)


def test_sniff_image_detects_the_real_type():
    assert sniff_image(b'\xff\xd8\xff\xe0' + b'0' * 10) == 'image/jpeg'
    assert sniff_image(b'\x89PNG\r\n\x1a\n' + b'0' * 10) == 'image/png'
    assert sniff_image(b'GIF89a') is None and sniff_image(b'hola mundo') is None and sniff_image(b'') is None
