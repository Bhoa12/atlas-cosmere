# Núcleo de expansión del Cosmere

## Objetivo
Separar el modelo técnico reutilizable del contenido editorial específico de cada mundo. El núcleo no contiene sinopsis, personajes ni datos de lore.

## Modelo
- WorldCatalog agrupa obras de un mundo.
- WorkCatalog define unidades de lectura ordenadas.
- ReadingProgress registra el último orden completado por obra.
- SpoilerBoundary expresa el mínimo de lectura necesario para mostrar contenido.

Una pieza puede depender de varias obras; todas las fronteras deben cumplirse.

## Migración
Los sistemas existentes convierten su progreso a ReadingProgress. La normalización conserva siempre el avance máximo, de modo que una migración no reduce contenido ya desbloqueado.

## Integración gradual
1. Registrar catálogos estructurales por mundo sin texto editorial.
2. Adaptar el progreso de Roshar al modelo común.
3. Usar SpoilerBoundary en consumidores nuevos.
4. Añadir contenido solo desde fuentes verificadas y con su frontera de lectura.
5. Ejecutar comprobación de TypeScript y la suite de pruebas disponible antes de fusionar.

Scadrial, Sel, Nalthis y Taldain son los primeros consumidores previstos; otros mundos pueden añadirse sin cambiar el contrato.