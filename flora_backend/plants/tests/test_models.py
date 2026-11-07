import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError
from django.utils import timezone

from plants.models import FotoPlanta, Plant, PlantCategory, Racha, Riego
from plants.tests.helpers import at_noon

pytestmark = pytest.mark.django_db


def test_table_names_follow_the_design_document():
    assert PlantCategory._meta.db_table == 'categorias_planta'
    assert Plant._meta.db_table == 'plantas'
    assert Racha._meta.db_table == 'rachas'
    assert FotoPlanta._meta.db_table == 'fotos_planta'
    assert Riego._meta.db_table == 'riegos'


def test_categories_are_seeded_by_the_migration():
    names = set(PlantCategory.objects.values_list('nombre', flat=True))
    assert {'Tropical', 'Suculenta', 'Aromática', 'Helecho'} <= names


def test_deleting_a_user_cascades_to_everything_they_own(user, plant):
    Riego.objects.create(planta=plant, regado_en=timezone.now())
    FotoPlanta.objects.create(planta=plant, url='https://cdn.flora/foto.jpg')
    Racha.objects.create(user=user)

    user.delete()

    assert Plant.objects.count() == 0
    assert Riego.objects.count() == 0
    assert FotoPlanta.objects.count() == 0
    assert Racha.objects.count() == 0
    assert PlantCategory.objects.filter(nombre='Tropical').exists()  # el catálogo no se toca


def test_deleting_a_plant_cascades_to_riegos_and_photos(plant):
    Riego.objects.create(planta=plant, regado_en=timezone.now())
    FotoPlanta.objects.create(planta=plant, url='https://cdn.flora/foto.jpg')

    plant.delete()

    assert Riego.objects.count() == 0 and FotoPlanta.objects.count() == 0


def test_a_category_in_use_cannot_be_deleted(plant):
    with pytest.raises(ProtectedError):
        plant.categoria.delete()


def test_same_watering_instant_cannot_be_stored_twice(plant):
    moment = at_noon(1)
    Riego.objects.create(planta=plant, regado_en=moment)

    with pytest.raises(IntegrityError), transaction.atomic():
        Riego.objects.create(planta=plant, regado_en=moment)


def test_client_local_id_is_unique_per_user_but_nulls_and_other_users_are_fine(user, other_user):
    Plant.objects.create(user=user, nombre_comun='A', client_local_id=-5)
    Plant.objects.create(user=user, nombre_comun='B')  # sin id local
    Plant.objects.create(user=user, nombre_comun='C')  # varios NULL permitidos
    Plant.objects.create(user=other_user, nombre_comun='D', client_local_id=-5)  # otro usuario

    with pytest.raises(IntegrityError), transaction.atomic():
        Plant.objects.create(user=user, nombre_comun='E', client_local_id=-5)


def test_adjusted_frequency_property(plant):
    plant.nivel_luz = 'baja'
    assert plant.frecuencia_ajustada_dias == 9
    plant.nivel_luz = ''
    assert plant.frecuencia_ajustada_dias == 7
