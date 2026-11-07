#!/usr/bin/env bash
# Build de Render: instala dependencias, recolecta estáticos y migra la base de datos.
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt

python manage.py collectstatic --no-input
python manage.py migrate --no-input
