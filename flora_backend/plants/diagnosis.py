"""
Diagnóstico de salud vegetal por síntomas (HU-FLOR-012): base de reglas causales.
Lógica pura (sin Django). El catálogo coincide con CATALOGO_SINTOMAS de la app móvil
(SymptomDiagnosisModal.js), que lo usa como respaldo sin conexión.
"""

SYMPTOMS = (
    {
        'id': 's1',
        'titulo': '🟡 Hojas amarillas y blandas',
        'causa': 'Exceso de riego (asfixia radicular)',
        'solucion': (
            'Pausa el riego inmediatamente. Permite que los primeros 3 cm de sustrato se sequen '
            'totalmente antes de volver a regar.'
        ),
        'tipo': 'exceso',
    },
    {
        'id': 's2',
        'titulo': '🍂 Hojas marrones, secas y crujientes',
        'causa': 'Falta de riego o humedad ambiental baja',
        'solucion': (
            'Realiza un riego por inmersión de 15 minutos y pulveriza sus hojas si es una especie tropical.'
        ),
        'tipo': 'falta',
    },
    {
        'id': 's3',
        'titulo': '⚫ Manchas negras u oscuras en follaje',
        'causa': 'Infección fúngica por exceso de humedad en hojas',
        'solucion': 'Poda las hojas infectadas con tijera desinfectada y evita mojar el follaje al regar.',
        'tipo': 'hongo',
    },
    {
        'id': 's4',
        'titulo': '🥀 Plantas caídas o tallos débiles',
        'causa': 'Estrés hídrico o falta de luminosidad',
        'solucion': (
            'Verifica la humedad del sustrato. Si está seco, riega; si está húmedo, traslada a un lugar '
            'más iluminado.'
        ),
        'tipo': 'luz',
    },
)

SYMPTOM_IDS = tuple(symptom['id'] for symptom in SYMPTOMS)


def get_symptom(symptom_id):
    """Copia del síntoma del catálogo, o None si no existe."""
    for symptom in SYMPTOMS:
        if symptom['id'] == symptom_id:
            return dict(symptom)
    return None


def extra_advice(symptom_id, categoria=None, nivel_luz=None, ubicacion=None, dias_restantes=None):
    """
    Recomendaciones adicionales según los datos de la planta (si se conocen).
    `dias_restantes` viene de la agenda: negativo = riego atrasado, positivo = aún no le toca.
    """
    categoria = (categoria or '').strip().lower()
    advice = []

    if symptom_id == 's1':
        if categoria == 'suculenta':
            advice.append(
                'Las suculentas guardan agua en sus hojas: deja secar el sustrato por completo y espacia más los riegos.'
            )
        if dias_restantes is not None and dias_restantes > 0:
            advice.append(
                'Según tu agenda aún no le tocaba regar: puede que se haya regado de más o que la maceta '
                'no drene bien. Revisa que tenga agujeros de drenaje.'
            )

    elif symptom_id == 's2':
        if dias_restantes is not None and dias_restantes < 0:
            late = abs(dias_restantes)
            advice.append(f'Va {late} {"día" if late == 1 else "días"} atrasada en su riego: riégala hoy.')
        if categoria == 'tropical' and ubicacion == 'interior':
            advice.append(
                'Las tropicales de interior agradecen más humedad ambiental: agrúpala con otras plantas o '
                'usa una bandeja con piedras y agua.'
            )

    elif symptom_id == 's3':
        if ubicacion == 'interior':
            advice.append('Mejora la ventilación del lugar y aísla la planta de las demás hasta que se recupere.')

    elif symptom_id == 's4':
        if nivel_luz == 'baja':
            advice.append(
                'Su lugar tiene luz baja: acércala a una ventana luminosa, evitando el sol directo muy fuerte.'
            )
        if dias_restantes is not None and dias_restantes < 0:
            advice.append('Su riego está atrasado: revisa el sustrato y riégala si está seco.')

    return advice
