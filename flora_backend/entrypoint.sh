#!/bin/sh
# entrypoint.sh - Arranque del backend F.L.O.R.A. (Docker local y Render).
# - Espera a la base de datos leyendo host y puerto de DATABASE_URL (máx. 30 s).
#   Sin DATABASE_URL (SQLite) no espera nada.
# - Aplica migraciones, junta los estáticos y arranca gunicorn en $PORT (Render lo define;
#   en local usa 8000).
set -e

if [ -n "$DATABASE_URL" ]; then
  DB_HOST=$(python -c "import os; from urllib.parse import urlparse; print(urlparse(os.environ['DATABASE_URL']).hostname or '')")
  DB_PORT=$(python -c "import os; from urllib.parse import urlparse; print(urlparse(os.environ['DATABASE_URL']).port or 5432)")

  if [ -n "$DB_HOST" ]; then
    echo "Esperando a la base de datos en ${DB_HOST}:${DB_PORT}..."
    tries=0
    until nc -z "$DB_HOST" "$DB_PORT" || [ "$tries" -ge 60 ]; do
      tries=$((tries + 1))
      sleep 0.5
    done
    echo "Continuando (intentos de espera: ${tries})."
  fi
fi

echo "Ejecutando migraciones de base de datos..."
python manage.py migrate --noinput

echo "Recolectando archivos estáticos para WhiteNoise..."
python manage.py collectstatic --noinput

echo "Iniciando Gunicorn en 0.0.0.0:${PORT:-8000}..."
exec gunicorn config.wsgi:application \
  --bind "0.0.0.0:${PORT:-8000}" \
  --workers "${WEB_CONCURRENCY:-2}" \
  --timeout 120