# EXPANSION RUN 86

Esta iteración añade una capa de validación reutilizable para la expansión del Atlas.

## Límites de procedencia

El catálogo bibliográfico puede registrar títulos y metadatos. No autoriza por sí mismo a crear capítulos, secciones ni resúmenes narrativos. Las unidades de lectura solo se aceptan cuando su fuente está marcada como `editorial-accessible` y accesible.

Las fuentes privadas declaradas siguen pudiendo existir en el catálogo sin afirmar que su contenido haya sido inspeccionado.

## Integridad

- Los vínculos mundo–obra se validan contra entidades y fuentes conocidas.
- Las unidades duplicadas o con posiciones duplicadas se rechazan de la estructura validada.
- El progreso solo cuenta cuando la unidad pertenece a la misma obra que el snapshot.
- Las puertas anti-spoilers fallan cerradas ante requisitos vacíos, duplicados o desconocidos.

Las pruebas usan exclusivamente datos sintéticos; no incorporan texto protegido ni hechos narrativos.
