"""
Almacenamiento de fotos de plantas.

Versión mínima para desarrollo: guarda en MEDIA_ROOT con el storage por defecto de Django.
En la Fase 3 se puede reemplazar por Supabase Storage manteniendo la misma firma:
    save_photo(plant, file) -> str  (URL, absoluta o relativa a MEDIA_URL)

Si ya tienes un photo_storage.py propio, NO lo sobrescribas: solo asegúrate de que
exponga save_photo(plant, file) -> url.
"""
import uuid

from django.core.files.storage import default_storage


def save_photo(plant, file):
    name = f'plantas/{plant.user_id}/{plant.id}/{uuid.uuid4().hex}.jpg'
    saved_name = default_storage.save(name, file)
    return default_storage.url(saved_name)
