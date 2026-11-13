# Hoid IA: normalización del progreso de lectura

`readingProgressNormalizer.ts` convierte el progreso declarado por el lector en una frontera estructural verificable antes de construir cualquier presupuesto de conocimiento.

## Reglas

- Cada obra debe existir en el catálogo canónico.
- El capítulo debe ser un entero mayor o igual que cero.
- Dos posiciones distintas para la misma obra son un conflicto y se rechazan.
- El resultado es una instantánea independiente para cada solicitud.

## Propiedad de seguridad

La normalización **no autoriza conocimiento narrativo**. Solo establece hasta qué punto puede consultar evidencia una capa posterior. El catálogo puede conocer una obra sin que su contenido sea accesible.

El flujo esperado es:

`catálogo → normalización del progreso → presupuesto de conocimiento → contexto autorizado → proveedor → verificación → filtro`

Si el progreso es ambiguo o una obra no está catalogada, la operación falla de forma cerrada. Hoid IA no debe adivinar la posición ni ampliar el límite de spoilers.
