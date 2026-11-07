"""
plants/utils.py - Validación de Luminancia Percibida para Imágenes Botánicas (HU-FLOR-010)
Calcula el brillo promedio mediante la matriz de píxeles BT.601 ($L = 0.299R + 0.587G + 0.114B$).
"""
from PIL import Image, ImageStat
from rest_framework.exceptions import ValidationError


def validar_luminosidad_imagen(imagen_file, rango_min=40, rango_max=240):
    """
    Inspecciona los bytes de la foto y calcula la luminancia percibida promedio en escala 0-255.
    Lanza ValidationError (HTTP 400) si la foto es demasiado oscura o está sobreexpuesta.
    """
    try:
        imagen = Image.open(imagen_file)
        imagen_gris = imagen.convert('L')  # Convertir a escala de grises
        stat = ImageStat.Stat(imagen_gris)
        luminancia = stat.mean[0]

        # Reposicionar el puntero de lectura del archivo para no alterar cargas posteriores
        imagen_file.seek(0)

        if luminancia < rango_min:
            raise ValidationError({
                "imagen": f"La fotografía es demasiado oscura (Luminancia: {luminancia:.1f}/255). Se requiere iluminación de al menos {rango_min}."
            })
        if luminancia > rango_max:
            raise ValidationError({
                "imagen": f"La fotografía presenta exceso de brillo o sobreexposición (Luminancia: {luminancia:.1f}/255). Máximo tolerable: {rango_max}."
            })

        return True, round(luminancia, 2)
    except Exception as e:
        if isinstance(e, ValidationError):
            raise e
        raise ValidationError({"imagen": "El archivo proporcionado no es un objeto de imagen válido o está corrupto."})