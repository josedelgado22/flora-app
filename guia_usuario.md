# GUÍA DE USUARIO — PLATAFORMA MÓVIL F.L.O.R.A. (v1.0)
**Sistema de Asistencia Botánica, Control de Riego y Diagnóstico Fitopatológico**

---

## 1. Introducción
**F.L.O.R.A.** es una aplicación móvil diseñada para facilitar las labores diarias de inventario, mantenimiento hídrico y detección temprana de enfermedades en viveros e invernaderos. La aplicación opera tanto con conexión a internet (utilizando Inteligencia Artificial) como en zonas sin cobertura celular (mediante almacenamiento local automático).

---

## 2. Acceso y Autenticación Segura (2FA)
1. **Registro de Operario (`RegisterScreen`):** Ingrese su nombre, correo electrónico institucional y una contraseña segura.
2. **Inicio de Sesión (`LoginScreen`):** Introduzca sus credenciales registradas.
3. **Verificación en Dos Pasos (`VerifyCodeScreen`):** Por seguridad, el sistema enviará un código numérico de **6 dígitos** a su correo electrónico (válido por 5 minutos). Ingréselo en pantalla para acceder al sistema.

---

## 3. Pantalla Principal y Mascota Virtual "Espina" (`HomeScreen`)
Al ingresar, visualizará el resumen general de su jardín/vivero y a **"Espina"**, el asistente virtual cuyo estado refleja la salud de sus plantas:
* **Estados Dinámicos:** Espina cambia su expresión (feliz, emocionado, neutral, sediento/triste o durmiendo) según el cumplimiento de los riegos programados.
* **Interacción Directa:** Al tocar a Espina en la pantalla principal, se despliega una tarjeta con el nivel de racha actual y un consejo rápido de cuidado botánico.

---

## 4. Identificación de Especies Botánicas
Desde la pestaña **Escanear (`ScanScreen`)**, dispone de dos métodos de identificación:

### A. Reconocimiento por Fotografía (Inteligencia Artificial)
1. Siga las recomendaciones en pantalla (luz natural, hoja centrada y fondo despejado).
2. Capture una fotografía o selecciónela desde su galería.
3. El sistema analizará la imagen y mostrará la especie detectada junto con una **Insignia de Certidumbre** verde (ej. *Verificada por IA: 63%*) que indica el nivel de confianza del modelo.

### B. Cuestionario Botánico Asistido (`ManualQuizScreen`)
Si se encuentra dentro de un invernadero sin señal de internet o la planta no logra identificarse por cámara, seleccione **Identificación Manual**:
1. Responda 3 preguntas visuales sobre la **forma de las hojas**, el **hábito de crecimiento** y la **ubicación** (interior o exterior).
2. El motor local calculará las especies más probables del catálogo, etiquetándolas con una insignia azul (*Clasificación Heurística Local*).

---

## 5. Evaluación Lumínica y Compatibilidad (`EnvironmentScanScreen`)
Antes de ubicar una planta en un sector del vivero:
1. Acceda al escáner de entorno y apunte la cámara hacia la fuente de luz del sector.
2. La aplicación medirá el nivel de iluminación ambiental y mostrará en **`CompatibilityResultScreen`** si el espacio es óptimo, aceptable o riesgoso para los requerimientos de la especie seleccionada.

---

## 6. Diagnóstico de Salud y Plagas (`DiagnosisScreen`)
Si observa deterioro en una planta:
1. Ingrese a la opción **Diagnosticar Salud** desde la ficha de la planta.
2. Seleccione los síntomas visibles mediante los íconos descriptivos (manchas foliares, polvillo blanco, amarilleamiento, bordes secos, presencia de plagas o estado del sustrato).
3. El sistema entregará el diagnóstico probable, su nivel de severidad y el tratamiento orgánico o preventivo recomendado.

---

## 7. Gestión del Jardín y Agenda de Riego
* **Ficha de Planta (`PlantDetailScreen`):** Al tocar cualquier planta registrada, podrá visualizar su fotografía, requerimientos ambientales, insignia de origen de identificación e historial cronológico de riegos.
* **Calendario de Riego (`WateringScheduleScreen`):** Muestra las tareas pendientes del día y de la semana. Al presionar **Registrar Riego**, el dispositivo emitirá una vibración de confirmación y actualizará la racha de cuidado. Si el widget flotante de Espina cubre información inferior, tóquelo para minimizarlo a modo burbuja.

---

## 8. Perfil, Accesibilidad y Modo Sin Internet (`ProfileScreen`)
En la sección de **Perfil y Ajustes** puede personalizar la aplicación según sus necesidades en terreno:
* **Tamaño de Texto:** Ajuste la tipografía entre *Normal*, *Grande* y *Más grande* para facilitar la lectura bajo luz solar directa.
* **Vibración Háptica:** Active o desactive la confirmación táctil al registrar tareas.
* **Trabajo Offline:** Si pierde conexión a internet, continúe registrando riegos y diagnósticos con normalidad; los datos se guardan en el teléfono y se sincronizan automáticamente al recuperar señal.
* **Cierre de Sesión:** Utilice el botón *Cerrar Sesión* al finalizar su turno para proteger su cuenta.