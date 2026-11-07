"""
Reglas de negocio puras (sin Django). Deben coincidir con la app móvil:
  src/utils/compatibility.js (factor de evaporación), src/utils/watering.js (días hasta el riego).
"""
import math
from datetime import timedelta

# Más luz = más evaporación = riego más frecuente (menos días entre riegos)
EVAPORATION_FACTOR = {'baja': 1.3, 'media': 1.0, 'alta': 0.8}


def evaporation_factor(nivel_luz):
    return EVAPORATION_FACTOR.get(nivel_luz, 1.0)


def adjusted_frequency(base_days, nivel_luz):
    """
    Frecuencia efectiva en días. floor(x + 0.5) replica Math.round de JavaScript (mitad hacia arriba);
    round() de Python redondea 6.5 a 6 y la app y el servidor darían fechas distintas.
    """
    return max(1, math.floor(base_days * evaporation_factor(nivel_luz) + 0.5))


def next_streak(current, best, last_day, day):
    """
    Racha tras un riego en `day` (fecha local). Devuelve (racha_actual, mejor_racha, ultimo_dia).
      - primer riego: 1 | mismo día: igual | día siguiente: +1 | salto de días: reinicia en 1
      - riego de un día ANTERIOR al último registrado (llegó tarde por sincronización): no altera la racha
    """
    if last_day is None:
        current, last_day = 1, day
    elif day == last_day:
        current = max(current, 1)
    elif day == last_day + timedelta(days=1):
        current, last_day = current + 1, day
    elif day > last_day:
        current, last_day = 1, day
    else:
        return current, best, last_day
    return current, max(best, current), last_day


def effective_streak(current, last_day, today):
    """Racha vigente hoy: sigue viva si el último riego fue hoy o ayer; si no, volvió a 0."""
    if last_day is None:
        return 0
    return current if last_day >= today - timedelta(days=1) else 0


def days_until_due(last_day, frequency_days, today):
    """Días calendario hasta el próximo riego (negativo = atrasada). Sin riegos registrados = hoy."""
    if last_day is None:
        return 0
    return ((last_day + timedelta(days=frequency_days)) - today).days


def agenda_status(days_left):
    if days_left < 0:
        return 'atrasada'
    if days_left == 0:
        return 'hoy'
    return 'ok'


def project_due_dates(last_day, frequency_days, today, horizon_days=14):
    """
    Riegos de UNA planta dentro del horizonte. Espejo de buildSchedule() en src/utils/schedule.js:
      - el próximo riego real (puede estar atrasado: dias_restantes < 0), si cae dentro del horizonte
      - los siguientes, asumiendo que se riega a tiempo (proyectado=True)
    @returns lista de {'dias_restantes': int, 'proyectado': bool}
    """
    frequency = max(1, frequency_days or 7)
    left = days_until_due(last_day, frequency, today)

    items = []
    if left < horizon_days:
        items.append({'dias_restantes': left, 'proyectado': False})

    k = 1
    while max(left, 0) + k * frequency < horizon_days:
        items.append({'dias_restantes': max(left, 0) + k * frequency, 'proyectado': True})
        k += 1
    return items
