from django.contrib import admin

from .models import FotoPlanta, Plant, PlantCategory, Racha, Riego


@admin.register(PlantCategory)
class PlantCategoryAdmin(admin.ModelAdmin):
    list_display = ('nombre',)


class FotoInline(admin.TabularInline):
    model = FotoPlanta
    extra = 0


@admin.register(Plant)
class PlantAdmin(admin.ModelAdmin):
    list_display = ('nombre_comun', 'user', 'categoria', 'nivel_luz', 'frecuencia_base_dias', 'ultimo_riego')
    list_filter = ('categoria', 'nivel_luz', 'ubicacion')
    search_fields = ('nombre_comun', 'nombre_cientifico', 'user__email')
    inlines = [FotoInline]


@admin.register(Riego)
class RiegoAdmin(admin.ModelAdmin):
    list_display = ('planta', 'regado_en')


@admin.register(Racha)
class RachaAdmin(admin.ModelAdmin):
    list_display = ('user', 'racha_actual', 'mejor_racha', 'ultimo_dia', 'mascota_nombre')
