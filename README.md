# F.L.O.R.A. — Sistema Inteligente de Gestión Botánica y Trazabilidad Fitopatológica

Plataforma móvil multiplataforma de arquitectura desacoplada y operación **Offline-First**, diseñada para optimizar el inventario botánico, el control de riego y el diagnóstico fitopatológico en el **Vivero Las Acacias** con un costo operacional de **$0 USD**.

---

## 1. Arquitectura y Estándares de Ingeniería

El sistema implementa una arquitectura cliente-servidor bajo la metodología **12-Factor App**, garantizando portabilidad, tolerancia a fallos y seguridad de credenciales:

* **Cliente Nativo (Frontend):** React Native `0.86.3` + Expo SDK `~57.0.32` (compilado a Hermes Bytecode `.hbc`).
* **Servidor API REST (Backend):** Django REST Framework desplegado en contenedor inmutable **Docker** (`python:3.11-slim` + Gunicorn) sobre **Render Cloud PaaS**.
* **Persistencia en la Nube:** PostgreSQL 15 en **Supabase DBaaS** bajo modelo relacional en **Tercera Forma Normal (3NF)** vía Connection Pooler (puerto `6543`).
* **Persistencia Local (Offline-First):** Motor embebido **Expo SQLite** (`~57.0.4`) para operación continua sin cobertura 4G/5G a `0 ms` de latencia.
* **Reconocimiento Taxonómico Dual (Smart Fallback):**
  * *Nivel 1 (Online BFF):* Integración con **Pl@ntNet API v2** (>40.000 especies) protegida en el backend (**OWASP Mobile M9**).
  * *Nivel 2 (Offline Local):* Patrón **Circuit Breaker** (`Aicircuit.js`) con conmutación automática a un **Sistema Experto Heurístico** (`quiz.js`, `diagnosisService.js`).
* **Accesibilidad y Calidad:** Cumplimiento de **ISO/IEC 25010** y **WCAG 2.1 Nivel AA** (iconografía vectorial `@expo/vector-icons`, escalado tipográfico dinámico y retroalimentación háptica).

---

## 2. Estructura del Proyecto

### Cliente Móvil (`flora_app/`)
```text
flora_app/
├── assets/
│   └── mascot/               # Estados gráficos deterministas de "Espina" (FSM)
├── src/
│   ├── components/           # Componentes UI reutilizables e insignias de certidumbre
│   ├── config/               # appConfig.js (Resolución dinámica de entornos)
│   ├── context/              # AuthContext, NotificationsContext, PetContext, PlantsContext
│   ├── data/                 # historydb.js (SQLite), quiz.js (Reglas), species.json
│   ├── hooks/                # useNetworkStatus.js (Detección de conectividad)
│   ├── navigation/           # AppNavigator, AuthStack, RootNavigator, ScanStack
│   ├── screens/              # Vistas: Login, VerifyCode (2FA), Home, Scan, EnvironmentScan,
│   │                         # ManualQuiz, Diagnosis, WateringSchedule, PlantDetail, Profile
│   ├── services/             # Aicircuit.js, Certainty.js, Demosettings.js, apiClient.js,
│   │                         # authService.js, plantIdService.js, syncService.js, tokenStorage.js
│   ├── theme/                # theme.js (Tokens de diseño y contraste WCAG 2.1)
│   └── utils/                # petFsm.js (Máquina de estados), compressPhoto.js, light.js,
│                             # schedule.js, streak.js, Timeago.js, watering.js
├── app.json                  # Configuración nativa de Expo
├── eas.json                  # Perfiles de compilación en la nube (EAS Build)
└── package.json              # Dependencias y scripts de ejecución
```

### Servidor Backend (`flora_backend/`)
```text
flora_backend/
├── accounts/                 # Autenticación, gestión de usuarios y verificación 2FA OTP
├── config/                   # Configuración central Django, CORS, seguridad y WSGI
├── identification/           # Patrón BFF para comunicación cifrada con Pl@ntNet API v2
├── plants/                   # Endpoints REST de inventario, riegos y bitácoras (3NF)
├── Dockerfile                # Definición de imagen inmutable de producción
├── render.yaml               # Infraestructura como código (IaC) para Render Cloud
└── pytest.ini                # Suite de pruebas unitarias e integración continua
```

---

## 3. Instalación y Ejecución Local

### Requisitos Previos
* Node.js (v18 o superior) y npm.
* Python 3.11+ (para ejecución local del backend).
* Dispositivo móvil con **Expo Go** o emulador Android.

### Paso 1: Levantar el Cliente Móvil
```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar el servidor de desarrollo Metro Bundler
npx expo start
```
* Escanea el código **QR** desde la app **Expo Go** en tu dispositivo Android.
* Presiona `w` en la consola si deseas previsualizar la interfaz web.

*(Nota para entornos Windows con versiones recientes de Node.js en modo web)*:
```powershell
$env:NODE_OPTIONS="--openssl-legacy-provider"
npx expo start --web
```

### Paso 2: Verificación de Salud y Compilación APK
```bash
# Auditar integridad de dependencias nativas (18/18 checks)
npx expo-doctor

# Generar binario ejecutable Android (.apk) en EAS Cloud
eas build -p android --profile preview
```

---

## 4. Seguridad y Gobernanza ($0 USD)
* Todas las llaves de terceros (`PLANTNET_API_KEY`, credenciales SMTP Brevo y URL de conexión PostgreSQL) se inyectan exclusivamente mediante variables de entorno en la memoria RAM del contenedor en Render Cloud.
* Los tokens de sesión en el dispositivo móvil se resguardan mediante `expo-secure-store` bajo estándares **OWASP Mobile M9**.

## 5. Variables de Entorno y Configuración (12-Factor App)

Para ejecutar el proyecto en un entorno local aislado, replica las plantillas de configuración sin comprometer secretos en el control de versiones:

* **Backend (`flora_backend/.env`):** Basado en `.env.example`[cite: 10], define las credenciales de conexión a PostgreSQL (Supabase Pooler), la clave `PLANTNET_API_KEY`, las credenciales SMTP (Brevo) y `SECRET_KEY` de Django.
* **Frontend (`flora_app/src/config/appConfig.js`):** Resuelve dinámicamente la URL base hacia `https://flora-backend-api.onrender.com` en compilaciones de producción o hacia la IP local en desarrollo[cite: 6].

---

## 6. Ejecución del Backend y Suite de Pruebas (QA)

### Levantar API REST en Local
```bash
cd flora_backend
python -m venv .venv
# Activar entorno virtual en Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver
```

### Ejecución de Pruebas Automatizadas y Auditoría
* **Pruebas Unitarias e Integración Backend (`pytest`):**[cite: 10]
  ```bash
  cd flora_backend
  pytest
  ```
* **Auditoría de Salud del Cliente Móvil:**[cite: 9]
  ```powershell
  cd flora_app
  ./verificar_flora.ps1
  npx expo-doctor
  ```

---

## 7. Endpoints REST Principales (Producción Render Cloud)

| Método | Endpoint | Descripción | Seguridad / Estándar |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health/` | Sonda de disponibilidad y despertar de contenedor (*Warmup*). | Público (12-Factor App) |
| `POST` | `/api/v1/auth/login/` | Autenticación inicial y despacho de código OTP 2FA vía Brevo. | HTTPS/TLS + Exp. 5 min |
| `POST` | `/api/v1/identify/` | Patrón BFF: procesa imagen foliar y consulta a Pl@ntNet API v2. | JWT + OWASP Mobile M9 |
| `GET/POST` | `/api/v1/plants/` | Sincronización de inventario botánico y bitácora de riegos (3NF). | JWT + Integridad SQL |

---

## 8. Licencia y Autoría
Proyecto desarrollado bajo los términos especificados en el archivo `LICENSE` del repositorio. Ingeniería y desarrollo full-stack orientados a la gestión sostenible del **Vivero Las Acacias** a **$0 USD** de costo operacional.