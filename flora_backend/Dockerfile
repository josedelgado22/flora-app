FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . /app/

# Los .sh editados en Windows traen saltos de línea CRLF y fallan en Linux ("no such file or directory"):
# se normalizan a LF antes de hacerlo ejecutable.
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Render define $PORT; en local el contenedor escucha en 8000.
EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]