# Hoid IA: frontera de recomendaciones

Las recomendaciones de Hoid IA son una frontera de seguridad independiente de la generación de respuestas.

## Datos permitidos

`planSafeCatalogRecommendations` trabaja únicamente con identificadores candidatos, títulos y metadatos del catálogo, y progreso de lectura validado por los contratos existentes.

No acepta ni genera acontecimientos narrativos como justificación. Sus razones son categorías cerradas:

- `catalog-availability`;
- `recorded-reading-continuity`.

## Fallo conservador

Los lotes de candidatos sobredimensionados o malformados devuelven una lista vacía. Los identificadores duplicados se deduplican de forma estable y los candidatos desconocidos o ambiguos se rechazan.

La frontera no establece un orden narrativo universal ni infiere continuidad argumental. Si una integración necesita una secuencia de lectura, debe aportar una lista de candidatos previamente validada por metadatos estructurales; la frontera solo comprueba que cada resultado pueda expresarse sin introducir hechos no autorizados.

Como el resto de Hoid IA, este módulo no copia ni almacena pasajes protegidos de las fuentes privadas.
