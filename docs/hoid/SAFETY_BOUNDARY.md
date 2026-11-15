# Hoid IA: catálogo y frontera de spoilers

Esta primera implementación crea dos piezas reutilizables y desacopladas:

1. `catalog.ts` representa la bibliografía aportada como **metadatos**. No contiene texto de EPUB ni pretende indicar que una obra completa esté accesible.
2. `safetyBoundary.ts` convierte el progreso explícito del lector en un límite de autorización.

## Regla principal

Una pieza de evidencia solo llega al contexto si cumple simultáneamente:

- pertenece a una fuente conocida del catálogo;
- pertenece exactamente a la obra indicada por el progreso;
- su capítulo es un entero positivo;
- su capítulo no supera el capítulo declarado por el lector;
- tiene identificador y resumen original no vacíos.

No hay recuperación alternativa cuando no existe evidencia autorizada: el resultado es una abstención estructurada mediante `no-authorized-evidence`.

## Integración futura

Un adaptador de EPUB puede aportar únicamente estructura y metadatos permitidos, y un proceso editorial puede añadir resúmenes originales. Un proveedor de IA debe consumir `SafeContext`, no los archivos privados ni un catálogo narrativo completo.

La capa no interpreta pasajes inaccesibles ni rellena huecos con conocimiento supuesto.