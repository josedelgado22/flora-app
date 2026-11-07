# Migración escrita a mano (equivale a `makemigrations plants`).
# Verifica con:  python manage.py makemigrations --check --dry-run
# Si Django propone cambios, borra este archivo y ejecuta: python manage.py makemigrations plants
# (conserva 0002_seed_categories.py y ajusta su dependencia al nuevo 0001 si cambia el nombre).
import django.core.validators
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PlantCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=50, unique=True)),
            ],
            options={'db_table': 'categorias_planta', 'ordering': ['nombre']},
        ),
        migrations.CreateModel(
            name='Plant',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('especie_slug', models.CharField(blank=True, default='', max_length=80)),
                ('nombre_comun', models.CharField(max_length=100)),
                ('nombre_cientifico', models.CharField(blank=True, default='', max_length=150)),
                ('nivel_luz', models.CharField(blank=True, choices=[('baja', 'Baja'), ('media', 'Media'), ('alta', 'Alta')], default='', max_length=5)),
                ('ubicacion', models.CharField(blank=True, choices=[('interior', 'Interior'), ('exterior', 'Exterior')], default='', max_length=8)),
                ('frecuencia_base_dias', models.PositiveSmallIntegerField(default=7, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(365)])),
                ('ultimo_riego', models.DateTimeField(blank=True, null=True)),
                ('client_local_id', models.BigIntegerField(blank=True, null=True)),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('actualizado_en', models.DateTimeField(auto_now=True)),
                ('categoria', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='plants', to='plants.plantcategory')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='plants', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'plantas', 'ordering': ['nombre_comun', 'id']},
        ),
        migrations.CreateModel(
            name='Riego',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('regado_en', models.DateTimeField()),
                ('planta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='riegos', to='plants.plant')),
            ],
            options={'db_table': 'riegos', 'ordering': ['-regado_en']},
        ),
        migrations.CreateModel(
            name='Racha',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('racha_actual', models.PositiveIntegerField(default=0)),
                ('mejor_racha', models.PositiveIntegerField(default=0)),
                ('ultimo_dia', models.DateField(blank=True, null=True)),
                ('mascota_nombre', models.CharField(default='Espina', max_length=20)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='racha', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'rachas'},
        ),
        migrations.CreateModel(
            name='FotoPlanta',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(choices=[('planta', 'Planta'), ('lugar', 'Lugar')], default='planta', max_length=6)),
                ('url', models.CharField(max_length=500)),
                ('tomada_en', models.DateTimeField(default=django.utils.timezone.now)),
                ('planta', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fotos', to='plants.plant')),
            ],
            options={'db_table': 'fotos_planta', 'ordering': ['-tomada_en']},
        ),
        migrations.AddConstraint(
            model_name='plant',
            constraint=models.UniqueConstraint(condition=models.Q(('client_local_id__isnull', False)), fields=('user', 'client_local_id'), name='uniq_planta_user_local'),
        ),
        migrations.AddConstraint(
            model_name='riego',
            constraint=models.UniqueConstraint(fields=('planta', 'regado_en'), name='uniq_riego_planta_fecha'),
        ),
        migrations.AddIndex(
            model_name='riego',
            index=models.Index(fields=['planta', '-regado_en'], name='idx_riego_planta_fecha'),
        ),
    ]
