# F.L.O.R.A. — App móvil

## Estructura
```
screens/          Pantallas de la app (UI)
  LoginScreen.js
  HomeScreen.js
  ScanScreen.js
  PlantDetailScreen.js

services/         Todo lo relacionado a la API y base de datos
  config.js       URL del backend (CAMBIAR cuando esté desplegado)
  api.js          Cliente axios central
  authService.js  Login, registro, logout
  plantService.js Identificar planta, analizar entorno, guardar en jardín
```

## Dónde conectar el backend (José)
Todos los `TODO` en `services/authService.js` y `services/plantService.js`
son los puntos donde hay que reemplazar los datos de prueba por llamadas
reales al backend Django. Cada función ya tiene comentado un ejemplo de
cómo debería quedar el código con axios.

Primero cambia la URL en `services/config.js` por la del backend real.

## Cómo correrlo
```
npm install
npx expo start
```
- Presiona `w` para verlo en el navegador
- Escanea el QR con la app Expo Go para verlo en tu celular

⚠️ Si les sale un error de "digital envelope routines" al correr en web,
es por la versión de Node. Corran esto antes de `npx expo start`:
```
set NODE_OPTIONS=--openssl-legacy-provider     (Windows cmd)
$env:NODE_OPTIONS="--openssl-legacy-provider"  (PowerShell)
```

## Cómo generar el APK
1. Crear cuenta gratis en https://expo.dev
2. Instalar la herramienta de build:
   ```
   npm install -g eas-cli
   eas login
   ```
3. Dentro de la carpeta del proyecto:
   ```
   eas build:configure
   eas build -p android --profile preview
   ```
4. Al terminar (demora unos minutos, se hace en la nube de Expo),
   entrega un link para descargar el `.apk` directo al celular.
