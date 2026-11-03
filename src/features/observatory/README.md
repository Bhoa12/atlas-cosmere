# Cosmere Observatory — fase I

## Decisiones de producto
- Entrada inicial: vista galáctica del Cosmere.
- Escala: artística. Las posiciones, radios y tamaños de la representación no son datos astronómicos canónicos.
- Los textos y metadatos descriptivos se reutilizan del catálogo existente de Atlas.

## Implementación incluida
- Pantalla independiente `src/screens/ObservatoryScreen.tsx`.
- Acceso desde la navegación principal mediante la pestaña Cosmere.
- Selección de sistemas y ficha resumida contextual.
- Modelo de dominio inicial en `models/celestialBody.ts`, con separación explícita entre metadatos de canon y parámetros de presentación artística.

## Límite deliberado de esta fase
La vista galáctica actual es una primera maqueta interactiva 2D hecha con componentes nativos de React Native. No se presenta como el motor 3D final. Se evita añadir dependencias gráficas antes de validar compatibilidad con Expo SDK 51 / React Native 0.74.5 y definir una ruta de actualización segura. La siguiente fase debe probar una escena mínima 3D en Android físico antes de sustituir esta maqueta.

## Próximos hitos
1. Validar navegación, TypeScript y layout en Android.
2. Instalar dependencias y ejecutar la app en un Android físico para validar el contexto GL, la carga de la escena y el rendimiento.
3. Añadir cámara/gestos (rotación manual, zoom y recentrado) y transiciones galáctica → sistema estelar.
4. Incorporar sistemas y cuerpos únicamente cuando sus datos estén documentados; marcar explícitamente lo aproximado o desconocido.
