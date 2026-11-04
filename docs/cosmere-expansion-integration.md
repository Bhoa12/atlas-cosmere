# Integración de la expansión del Cosmere

## Principio de diseño

La capa común modela **mundos → obras → unidades de lectura → progreso → puertas anti-spoiler**. La bibliografía y la estructura editorial se mantienen separadas: un título puede existir en el catálogo sin publicar todavía lore ni capítulos.

## Estado actual

El catálogo inicial incluye estructura bibliográfica para Scadrial, Sel, Nalthis y Taldain, además de Lumar y Canticle. Las unidades de lectura se añadirán únicamente tras extraer límites verificables de una fuente accesible.

## Integración con Roshar

1. Mantener los identificadores actuales de Roshar como adaptador de compatibilidad.
2. Migrar cada obra a `WorkCatalogEntry` sin cambiar el progreso del usuario.
3. Convertir el progreso existente mediante `progressAdapter`.
4. Añadir unidades ordenadas y validar el catálogo antes de activar contenido.
5. Asociar cada pieza editorial a una `SpoilerGate` y una referencia de fuente.

## Criterio de seguridad

Un contenido sin puerta de spoiler y procedencia verificable no debe publicarse como conocimiento del Atlas. El texto íntegro de obras protegidas no se almacena en el repositorio.
