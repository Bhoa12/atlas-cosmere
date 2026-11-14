# Hoid IA: contrato de recomendaciones

Las recomendaciones no deben convertirse en una vía indirecta de spoilers.

## Entrada autorizada

Un adaptador puede recibir la pregunta y el contexto estructural ya autorizado. Las razones de una recomendación deben identificarse como:

- preferencias explícitas del lector;
- metadatos del catálogo;
- progreso estructural.

El contrato no permite justificar una recomendación mediante conocimiento narrativo implícito.

## Verificación

`verifyRecommendations` aplica una política de fallo cerrado:

1. rechaza recomendaciones vacías;
2. exige al menos una razón;
3. rechaza cualquier identificador no autorizado;
4. deduplica razones sin ampliar la entrada.

Si una recomendación necesita hechos narrativos, debe pasar por el pipeline de evidencia y progreso, no por este contrato.

## Proveedores

El contrato es independiente de SDKs concretos. Un proveedor puede implementar generación, recomendaciones o ambas capacidades, pero ninguna puede ampliar por sí misma el conocimiento autorizado.
