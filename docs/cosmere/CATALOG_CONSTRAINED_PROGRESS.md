# Progreso restringido por catálogo

`constrainProgressToCatalog` es una frontera técnica entre progreso recibido y
coordenadas de lectura declaradas.

## Regla de seguridad

Solo conserva posiciones que existan explícitamente en las unidades de la obra
correspondiente. Las obras desconocidas y las posiciones no declaradas se
descartan.

La función normaliza primero el progreso para que estados duplicados no cambien
el resultado. Después aplica el catálogo como límite superior de confianza.

## Límites

Esta capa no:

- inspecciona EPUBs;
- crea unidades o capítulos;
- aproxima posiciones;
- convierte progreso entre obras;
- deduce hechos narrativos.

Por ello puede utilizarse antes de cualquier evaluación anti-spoilers cuando el
progreso procede de almacenamiento, sincronización o una futura importación.
