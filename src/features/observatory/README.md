# Cosmere Observatory — fase I

## Decisiones de producto
- Entrada inicial: vista galáctica del Cosmere.
- Escala: artística. Las posiciones, radios y tamaños son recursos de composición visual, no datos astronómicos canónicos.
- Los nombres y metadatos descriptivos se reutilizan del catálogo actual de Atlas.

## Implementación incluida
- Pantalla independiente: `src/screens/ObservatoryScreen.tsx`.
- Acceso desde la navegación principal mediante la pestaña Cosmere.
- Escena 3D inicial con React Three Fiber v8 y Three.js: núcleo luminoso, campo de estrellas, anillos orbitales ilustrativos y cuerpos que representan los sistemas del catálogo.
- Rotación ambiental lenta y resaltado del sistema seleccionado desde los controles nativos de la pantalla.
- Cámara orbital táctil: arrastre con un dedo para rotar, pinza con dos dedos para acercar/alejar y botón para restablecer el encuadre.
- Límites de zoom y de inclinación para evitar perder la escena.
- Modelo de dominio inicial en `models/celestialBody.ts`, que separa metadatos de canon y parámetros de presentación artística.

## Compatibilidad de dependencias
El proyecto permanece en Expo SDK 51, React 18.2 y React Native 0.74.5. Se han añadido versiones de la línea compatible:
- `@react-three/fiber ^8.17.10` (Fiber 8 corresponde a React 18).
- `three ^0.164.1`.
- `expo-gl ~14.0.2`.
- `expo-asset ~10.0.6`.
- `expo-file-system ~17.0.1`.

Instalar las dependencias con `npm install` y después ejecutar `npx expo start`. No se ha actualizado Expo ni React Native. No se ha generado lockfile porque el repositorio no contenía uno.

## Límites de esta fase
Esto es una prueba de integración 3D, no todavía la experiencia final. La cámara está fija y la rotación es ambiental; aún faltan rotación manual, zoom, recentrado y transiciones de vista galáctica a sistema estelar. No se ha podido ejecutar una compilación ni validar el contexto GL en un dispositivo Android físico desde esta edición remota.

## Próximos hitos
1. Instalar dependencias y validar la escena en un Android físico: contexto GL, renderizado, memoria y estabilidad.
2. Validar los gestos en Android físico y ajustar sensibilidad/rendimiento según el dispositivo.
3. Añadir selección directa tocando un sistema y desplazamiento lateral de cámara.
4. Implementar la transición galáctica → sistema estelar y después la exploración planetaria.
5. Incorporar cuerpos celestes solo cuando sus datos estén documentados; marcar explícitamente lo aproximado o desconocido.
