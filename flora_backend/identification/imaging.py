"""Detección del tipo real de imagen por sus primeros bytes (no se confía en el Content-Type del cliente)."""

JPEG_MAGIC = b'\xff\xd8\xff'
PNG_MAGIC = b'\x89PNG\r\n\x1a\n'


def sniff_image(data):
    """@returns 'image/jpeg' | 'image/png' | None"""
    if data.startswith(JPEG_MAGIC):
        return 'image/jpeg'
    if data.startswith(PNG_MAGIC):
        return 'image/png'
    return None
