"""
Modelo de datos de F.L.O.R.A. (Fase 2).

  cuentas (accounts.User) 1 ──< N plantas >── 1 categorias_planta
                          1 ──1 rachas
  plantas 1 ──< N riegos        (historial de riegos: base de la idempotencia y de las rachas)
  plantas 1 ──< N fotos_planta  (borrado en cascada)

Nota 3NF: se agrega `riegos` a las 5 entidades del DAS porque el historial de riegos es lo
que permite sincronizar sin duplicar (UNIQUE planta + instante) y calcular rachas. No guarda
datos derivados (el "día" del riego se calcula desde `regado_en`).
"""
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from .logic import adjusted_frequency


class PlantCategory(models.Model):
    nombre = models.CharField(max_length=50, unique=True)

    class Meta:
        db_table = 'categorias_planta'
        ordering = ['nombre']

    def __str__(self):
        return self.nombre


class Plant(models.Model):
    class Light(models.TextChoices):
        BAJA = 'baja', 'Baja'
        MEDIA = 'media', 'Media'
        ALTA = 'alta', 'Alta'

    class Location(models.TextChoices):
        INTERIOR = 'interior', 'Interior'
        EXTERIOR = 'exterior', 'Exterior'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='plants')
    categoria = models.ForeignKey(
        PlantCategory, on_delete=models.PROTECT, null=True, blank=True, related_name='plants'
    )
    especie_slug = models.CharField(max_length=80, blank=True, default='')
    nombre_comun = models.CharField(max_length=100)
    nombre_cientifico = models.CharField(max_length=150, blank=True, default='')
    nivel_luz = models.CharField(max_length=5, choices=Light.choices, blank=True, default='')
    ubicacion = models.CharField(max_length=8, choices=Location.choices, blank=True, default='')
    # Frecuencia BASE de la especie. La frecuencia efectiva se ajusta a la luz (ver logic.py).
    frecuencia_base_dias = models.PositiveSmallIntegerField(
        default=7, validators=[MinValueValidator(1), MaxValueValidator(365)]
    )
    ultimo_riego = models.DateTimeField(null=True, blank=True)
    # Id que la app le asignó offline (negativo). Evita duplicados al reintentar la sincronización.
    client_local_id = models.BigIntegerField(null=True, blank=True)
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'plantas'
        ordering = ['nombre_comun', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'client_local_id'],
                condition=models.Q(client_local_id__isnull=False),
                name='uniq_planta_user_local',
            )
        ]

    def __str__(self):
        return f'{self.nombre_comun} ({self.user_id})'

    @property
    def frecuencia_ajustada_dias(self):
        """Frecuencia de riego ajustada al factor de evaporación de la luz del lugar (HU-FLOR-008)."""
        return adjusted_frequency(self.frecuencia_base_dias, self.nivel_luz or None)


class Riego(models.Model):
    planta = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name='riegos')
    regado_en = models.DateTimeField()

    class Meta:
        db_table = 'riegos'
        ordering = ['-regado_en']
        constraints = [models.UniqueConstraint(fields=['planta', 'regado_en'], name='uniq_riego_planta_fecha')]
        indexes = [models.Index(fields=['planta', '-regado_en'], name='idx_riego_planta_fecha')]

    def __str__(self):
        return f'riego {self.planta_id} · {self.regado_en:%Y-%m-%d %H:%M}'


class Racha(models.Model):
    """Resumen de la racha de cuidado del usuario y nombre de su mascota (HU-FLOR-004)."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='racha')
    racha_actual = models.PositiveIntegerField(default=0)
    mejor_racha = models.PositiveIntegerField(default=0)
    ultimo_dia = models.DateField(null=True, blank=True)
    mascota_nombre = models.CharField(max_length=20, default='Espina')

    class Meta:
        db_table = 'rachas'

    def __str__(self):
        return f'racha {self.user_id}: {self.racha_actual}'


class FotoPlanta(models.Model):
    class Tipo(models.TextChoices):
        PLANTA = 'planta', 'Planta'
        LUGAR = 'lugar', 'Lugar'

    planta = models.ForeignKey(Plant, on_delete=models.CASCADE, related_name='fotos')
    tipo = models.CharField(max_length=6, choices=Tipo.choices, default=Tipo.PLANTA)
    url = models.CharField(max_length=500)  # URL en el almacenamiento (Fase 3: Supabase Storage)
    tomada_en = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'fotos_planta'
        ordering = ['-tomada_en']

    def __str__(self):
        return f'foto {self.tipo} · planta {self.planta_id}'
