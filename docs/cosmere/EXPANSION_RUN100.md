# EXPANSION RUN 100

## Objetivo

Esta iteración añade una proyección reutilizable de descriptores protegidos por progreso de lectura.

## Garantías

- Los descriptores son datos proporcionados explícitamente; la capa no genera hechos narrativos.
- Cada descriptor debe tener una fuente identificada y marcada como accesible.
- Cada requisito debe apuntar a una unidad accesible de la misma obra.
- Requisitos vacíos, duplicados o desconocidos invalidan el descriptor.
- La visibilidad es **fail-closed**: un descriptor solo aparece tras completar todos sus requisitos válidos.
- El progreso de otra obra nunca desbloquea contenido.

## Límites de procedencia

El catálogo privado puede registrar obras y fuentes, pero una fuente privada no accesible no respalda automáticamente descriptores narrativos ni estructura de lectura. Esta capa no copia texto protegido y no afirma haber inspeccionado pasajes que no estén disponibles.
