# Hoid IA: política de recomendaciones sin spoilers

Las recomendaciones necesitan una frontera propia: sugerir una obra, capítulo o tema por su importancia futura puede revelar información incluso cuando no se explica el motivo.

## Contrato

`buildSafeRecommendations` recibe un límite explícito de lectura y candidatos ya preparados. Solo permite:

1. la misma obra del límite;
2. capítulos ya autorizados;
3. recomendaciones de exploración del contexto actual sin capítulo futuro.

La función no consulta el catálogo para inferir qué debería leer el usuario después. El catálogo es metadato, no conocimiento narrativo.

## Fallo cerrado

Se descartan candidatos:

- de otra obra;
- de capítulos posteriores al progreso;
- sin texto;
- malformados.

Si no queda ninguna recomendación segura, el resultado es una abstención estructurada. No se sustituye con una recomendación basada en conocimiento general del proveedor.

## Integración

Esta política debe ejecutarse después de resolver el progreso y antes de presentar una recomendación generada por un proveedor. La generación puede proponer candidatos, pero no ampliar la frontera de lectura.

## Fuentes privadas

El contrato no contiene ni reproduce texto de los EPUB privados. Trabaja únicamente con identificadores de obra, capítulos autorizados y redacción original de recomendaciones.
