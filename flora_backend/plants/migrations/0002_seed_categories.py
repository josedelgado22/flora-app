from django.db import migrations

CATEGORIES = ['Aromática', 'Helecho', 'Suculenta', 'Tropical']  # las del catálogo local de la app


def seed(apps, schema_editor):
    PlantCategory = apps.get_model('plants', 'PlantCategory')
    for nombre in CATEGORIES:
        PlantCategory.objects.get_or_create(nombre=nombre)


def unseed(apps, schema_editor):
    apps.get_model('plants', 'PlantCategory').objects.filter(nombre__in=CATEGORIES).delete()


class Migration(migrations.Migration):

    dependencies = [('plants', '0001_initial')]

    operations = [migrations.RunPython(seed, unseed)]
