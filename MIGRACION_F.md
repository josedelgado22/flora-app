# Bloque F - Autenticación REAL (registro + 2FA por correo) contra el backend Django

1. Aplica el zip sobre el proyecto (Expand-Archive -Force).
2. src/config/appConfig.js -> ya viene con 192.168.1.9; si tu IP cambia, actualízala.
3. Backend: en flora_backend\.env agrega esa IP a ALLOWED_HOSTS y arranca con:
      python manage.py runserver 0.0.0.0:8000
   Permite Python en el Firewall de Windows (redes privadas).
4. Celular y PC en el mismo Wi-Fi. Abre en el navegador del celular  http://TU-IP:8000/api/v1/health/
   -> debe mostrar {"status":"ok"}. Si no abre, la app tampoco podrá conectar.
5. npx expo start -c

Volver a la autenticación simulada: appConfig.js -> REAL_AUTH = false (código 123456).
