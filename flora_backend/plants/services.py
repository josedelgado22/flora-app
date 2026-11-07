"""Casos de uso: riegos, rachas y agenda adaptativa."""
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .logic import (
    agenda_status,
    days_until_due,
    effective_streak,
    evaporation_factor,
    next_streak,
    project_due_dates,
)
from .models import Racha, Riego


def get_or_create_racha(user):
    racha, _ = Racha.objects.get_or_create(user=user)
    return racha


def update_streak(user, day):
    with transaction.atomic():
        racha, _ = Racha.objects.select_for_update().get_or_create(user=user)
        current, best, last_day = next_streak(racha.racha_actual, racha.mejor_racha, racha.ultimo_dia, day)
        racha.racha_actual, racha.mejor_racha, racha.ultimo_dia = current, best, last_day
        racha.save(update_fields=['racha_actual', 'mejor_racha', 'ultimo_dia'])
    return racha


def register_watering(plant, regado_en):
    """
    Registra un riego de forma IDEMPOTENTE: el mismo (planta, instante) no se duplica ni suma racha dos veces.
    @returns (riego, created)
    """
    with transaction.atomic():
        riego, created = Riego.objects.get_or_create(planta=plant, regado_en=regado_en)
        if created:
            if plant.ultimo_riego is None or regado_en > plant.ultimo_riego:
                plant.ultimo_riego = regado_en
                plant.save(update_fields=['ultimo_riego', 'actualizado_en'])
            update_streak(plant.user, timezone.localtime(regado_en).date())
    return riego, created


def racha_payload(racha, today=None):
    today = today or timezone.localdate()
    vigente = effective_streak(racha.racha_actual, racha.ultimo_dia, today)
    return {
        'racha_actual': vigente,
        'mejor_racha': max(racha.mejor_racha, vigente),
        'ultimo_dia': racha.ultimo_dia,
        'hecho_hoy': racha.ultimo_dia == today,
        'en_riesgo': vigente > 0 and racha.ultimo_dia != today,
        'mascota_nombre': racha.mascota_nombre,
    }


def agenda_item(plant, today):
    """Una fila de la agenda: cruza la frecuencia base de la especie con la luz y la evaporación."""
    last_day = timezone.localtime(plant.ultimo_riego).date() if plant.ultimo_riego else None
    frequency = plant.frecuencia_ajustada_dias
    left = days_until_due(last_day, frequency, today)
    return {
        'planta_id': plant.id,
        'nombre_comun': plant.nombre_comun,
        'ubicacion': plant.ubicacion,
        'nivel_luz': plant.nivel_luz,
        'frecuencia_base_dias': plant.frecuencia_base_dias,
        'factor_evaporacion': evaporation_factor(plant.nivel_luz),
        'frecuencia_riego_dias': frequency,
        'ultimo_riego': plant.ultimo_riego,
        'proximo_riego': today + timedelta(days=left),
        'dias_restantes': left,
        'estado': agenda_status(left),
    }


def agenda_projection(plant, today, horizon_days=14):
    """agenda_item() + la lista de riegos proyectados dentro del horizonte."""
    item = agenda_item(plant, today)
    last_day = timezone.localtime(plant.ultimo_riego).date() if plant.ultimo_riego else None
    item['riegos'] = [
        {
            'fecha': today + timedelta(days=entry['dias_restantes']),
            'dias_restantes': entry['dias_restantes'],
            'estado': agenda_status(entry['dias_restantes']),
            'proyectado': entry['proyectado'],
        }
        for entry in project_due_dates(last_day, item['frecuencia_riego_dias'], today, horizon_days)
    ]
    return item
