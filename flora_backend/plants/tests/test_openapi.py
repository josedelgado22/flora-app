"""El esquema OpenAPI se genera sin errores y documenta los endpoints principales (HU-FLOR-001)."""


def test_el_esquema_openapi_se_genera_y_lista_los_endpoints(anon):
    response = anon.get('/api/schema/?format=json')

    assert response.status_code == 200
    paths = response.json()['paths']
    for expected in ('/api/v1/plantas/', '/api/v1/agenda/', '/api/v1/sync/batch/', '/api/v1/rachas/me/'):
        assert expected in paths


def test_swagger_ui_es_publica(anon):
    assert anon.get('/api/docs/').status_code == 200
