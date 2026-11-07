# Verifica que el proyecto tenga la version final de la app.
# Ejecutar desde la raiz de flora_app:
#   powershell -ExecutionPolicy Bypass -File .\verificar_flora.ps1

$script:problemas = 0

function Check($path, $pattern, $label) {
    if (-not (Test-Path $path)) {
        Write-Host "FALTA   $label   [$path]" -ForegroundColor Red
        $script:problemas++
        return
    }
    if ($pattern -and -not (Select-String -Path $path -Pattern $pattern -SimpleMatch -Quiet)) {
        Write-Host "VIEJO   $label   [$path]" -ForegroundColor Yellow
        $script:problemas++
        return
    }
    Write-Host "OK      $label" -ForegroundColor Green
}

Write-Host "`n== Archivos de la app ==" -ForegroundColor Cyan
Check 'App.js'                                   'NotificationsProvider' 'App.js con todos los proveedores'
Check 'src/navigation/AppNavigator.js'           'WateringScheduleScreen' 'Tabs con la Agenda real'
Check 'src/navigation/ScanStack.js'              'CompatibilityResultScreen' 'Flujo de escaneo'
Check 'src/navigation/AuthStack.js'              'VerifyCodeScreen' 'Login, registro y verificacion'
Check 'src/navigation/RootNavigator.js'          'navigationRef' 'Navegacion raiz'
Check 'src/screens/HomeScreen.js'                'usePet' 'Jardin con Espina y racha real'
Check 'src/screens/ProfileScreen.js'             'useNotifications' 'Perfil con Espina y recordatorios'
Check 'src/screens/WateringScheduleScreen.js'    'buildSchedule' 'Agenda de riego'
Check 'src/screens/LoginScreen.js'               'VerifyCode' 'Login con 2FA'
Check 'src/screens/RegisterScreen.js'            'toChallenge' 'Registro con verificacion de correo'
Check 'src/screens/VerifyCodeScreen.js'          'isRegister' 'Pantalla del codigo de 6 digitos'
Check 'src/screens/ScanScreen.js'                'identifyPlant' 'Escaneo de planta'
Check 'src/screens/ManualQuizScreen.js'          'rankSpeciesByAnswers' 'Cuestionario manual (fallback)'
Check 'src/screens/EnvironmentScanScreen.js'     'analyzeLight' 'Medicion de luz'
Check 'src/context/PetContext.js'                'moodReducer' 'Mascota (FSM)'
Check 'src/context/PlantsContext.js'             'lastWatering' 'Contexto de plantas'
Check 'src/context/NotificationsContext.js'      'scheduleReminderPlan' 'Recordatorios'
Check 'src/context/AuthContext.js'               'verifyTwoFactor' 'Contexto de autenticacion'
Check 'src/components/MascotaWidget.js'          'usePet' 'MascotaWidget en components'
Check 'src/components/PlantCard.js'              'onReportSymptom' 'Tarjeta de planta'
Check 'src/config/appConfig.js'                  'REAL_AUTH' 'Configuracion con auth real'
Check 'src/services/apiClient.js'                'REAL_AUTH' 'Cliente HTTP con auth real'
Check 'src/services/authService.js'              'AUTH_REQUEST_TIMEOUT_MS' 'Servicio de autenticacion'
Check 'src/services/db.js'                       'watering_log' 'SQLite con historial de riegos'
Check 'src/utils/validation.js'                  'passwordChecks' 'Validacion del registro'
Check 'src/utils/watering.js'                    'getDueInfo' 'Calculo de riego'
Check 'src/theme/theme.js'                       'accentTint' 'Tema verde y rosa'
Check 'src/data/species.json'                    $null 'Catalogo de especies'

if (Test-Path 'src/screens/MascotaWidget.js') {
    Write-Host "BORRAR  src/screens/MascotaWidget.js (version vieja; ahora esta en src/components)" -ForegroundColor Yellow
    $script:problemas++
}

Write-Host "`n== Dependencias (package.json) ==" -ForegroundColor Cyan
$deps = 'expo-notifications','expo-image-picker','expo-image-manipulator','expo-sqlite','expo-secure-store',
        '@react-native-community/netinfo','jpeg-js','@react-navigation/native',
        '@react-navigation/bottom-tabs','@react-navigation/native-stack'
foreach ($d in $deps) {
    $needle = '"' + $d + '"'
    if (Select-String -Path 'package.json' -Pattern $needle -SimpleMatch -Quiet) {
        Write-Host "OK      $d" -ForegroundColor Green
    } else {
        Write-Host "SIN INSTALAR   $d   -> npx expo install $d" -ForegroundColor Red
        $script:problemas++
    }
}

Write-Host "`n== Conexion con el backend ==" -ForegroundColor Cyan
Select-String -Path 'src/config/appConfig.js' -Pattern 'API_BASE_URL =' |
    ForEach-Object { Write-Host $_.Line.Trim() }
Select-String -Path 'src/config/appConfig.js' -Pattern 'export const REAL_AUTH','export const FORCE_MOCKS' -SimpleMatch |
    ForEach-Object { Write-Host $_.Line.Trim() }

Write-Host ""
if ($script:problemas -eq 0) {
    Write-Host "Todo en orden. Reinicia con:  npx expo start -c" -ForegroundColor Green
} else {
    Write-Host "Hay $($script:problemas) problema(s). Corrige lo marcado y vuelve a ejecutar este script." -ForegroundColor Red
}
