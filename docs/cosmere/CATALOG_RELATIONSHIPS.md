# Relaciones entre mundos y obras

Este módulo valida la **integridad estructural** del catálogo de Atlas del Cosmere.

## Qué valida

- IDs únicos y no vacíos para mundos y obras.
- Que cada obra apunte a un mundo declarado.
- Que cada obra tenga título y una referencia a su fuente bibliográfica.

## Qué no hace

No infiere mundos, cronología, canon, capítulos ni hechos narrativos a partir de títulos o IDs. La relación editorial entre una obra y un mundo solo debe añadirse cuando esté respaldada por una fuente realmente disponible y verificada.

El campo `sourceId` mantiene la trazabilidad hacia el catálogo de fuentes privadas sin copiar el EPUB ni su texto.

## Uso con anti-spoilers

La capa de catálogo identifica entidades; las reglas anti-spoilers siguen siendo independientes y deben declarar requisitos explícitos. Así, una relación de catálogo válida no desbloquea por sí misma contenido narrativo.
