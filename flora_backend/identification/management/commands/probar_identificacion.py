"""Prueba la identificación SIN la app: python manage.py probar_identificacion ruta/foto.jpg"""
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from accounts.exceptions import APIError
from identification import services
from identification.imaging import sniff_image


class Command(BaseCommand):
    help = 'Identifica una foto con el modo configurado (Pl@ntNet real o simulado) y muestra el tiempo.'

    def add_arguments(self, parser):
        parser.add_argument('imagen', help='Ruta de una foto JPEG o PNG.')
        parser.add_argument('--organo', default='auto', choices=['auto', 'leaf', 'flower', 'fruit', 'bark'])

    def handle(self, *args, **options):
        path = Path(options['imagen'])
        if not path.is_file():
            raise CommandError(f'No existe el archivo: {path}')
        data = path.read_bytes()
        content_type = sniff_image(data)
        if content_type is None:
            raise CommandError('El archivo no es una imagen JPEG o PNG.')

        self.stdout.write(f"Modo: {'Pl@ntNet REAL' if services.is_real_mode() else 'SIMULADO (sin PLANTNET_API_KEY)'}")
        try:
            result = services.identify_image(data, path.name, content_type, options['organo'])
        except APIError as exc:
            raise CommandError(f'{exc.get_codes()}: {exc.detail}')

        for candidate in result['resultados']:
            catalog = 'catálogo' if candidate['en_catalogo'] else 'fuera del catálogo'
            self.stdout.write(f"  {candidate['coincidencia']:>3}%  {candidate['nombre_comun']} ({candidate['nombre_cientifico']}) [{catalog}]")
        if not result['resultados']:
            self.stdout.write('  Sin coincidencias.')

        ms = result['tiempo_ms']
        style = self.style.SUCCESS if ms <= services.SLA_MS else self.style.WARNING
        self.stdout.write(style(f"Tiempo: {ms} ms (SLA: {services.SLA_MS} ms)"))
