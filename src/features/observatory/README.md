# Cosmere Observatory — fase III

## Decisiones de producto
- Entrada inicial: vista galáctica del Cosmere.
- Escala: artística. Las posiciones, radios y tamaños son recursos de composición visual, no datos astronómicos canónicos.
- Los nombres y metadatos descriptivos se reutilizan del catálogo actual de Atlas.

## Implementación incluida
- Pantalla independiente: `src/screens/ObservatoryScreen.tsx`.
- Acceso desde la navegación principal mediante la pestaña Cosmere.
- Escena 3D con React Three Fiber v8 y Three.js: núcleo luminoso, campo de estrellas, anillos orbitales ilustrativos y cuerpos que representan los sistemas del catálogo.
- Cámara orbital táctil: arrastre con un dedo para rotar, pinza con dos dedos para acercar/alejar y botón para restablecer el encuadre. El enfoque y el cambio entre escalas interpolan la posición y distancia de cámara; el zoom también funciona en la vista de sistema.
- Selección directa de un sistema mediante toque: raycasting sobre las esferas 3D, resaltado y enfoque de cámara sobre el sistema seleccionado.
- Entrada a una vista de sistema estelar con esquema abstracto de estrella y órbitas ilustrativas, además de navegación para volver a la galaxia.
- La vista de sistema no representa planetas, lunas ni órbitas concretas: el catálogo todavía no proporciona datos verificados suficientes. No se generan cuerpos ficticios.
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
Esto sigue siendo una implementación inicial, pendiente de validación. No se ha ejecutado TypeScript, una compilación de Expo ni una prueba en dispositivo Android físico desde esta edición remota. La selección por raycasting, los gestos y el contexto GL deben verificarse en Android real. El esquema de sistema es conceptual y no constituye una afirmación de canon.

## Próximos hitos
1. Instalar dependencias y validar renderizado GL, selección táctil, gestos, memoria y estabilidad en Android físico.
2. Añadir desplazamiento lateral de cámara y probar la legibilidad de los encuadres en distintos tamaños de pantalla.
3. Integrar cuerpos celestes y sus fichas únicamente cuando existan datos documentados, marcando lo confirmado, aproximado y desconocido.
4. Revisar rendimiento, accesibilidad y adaptación a distintos tamaños de pantalla.
