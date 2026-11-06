# Progreso restringido por catálogo

`constrainProgressToCatalog` es una frontera técnica entre progreso recibido y
coordenadas de lectura declaradas.

## Regla de seguridad

Solo conserva posiciones que existan explícitamente en las unidades de la obra
correspondiente. Las obras desconocidas y las posiciones no declaradas se
descartan.

La función normaliza primero el progreso para que estados duplicados no cambien
el resultado. Después aplica el catálogo como límite superior de confianza.

Si un mismo identificador de obra aparece más de una vez, se considera ambiguo y
todo su progreso se descarta. La capa falla de forma segura: una entrada posterior
no puede sobrescribir silenciosamente las coordenadas de otra obra.

## Límites

Esta capa no:

- inspecciona EPUBs;
- crea unidades o capítulos;
- aproxima posiciones;
- convierte progreso entre obras;
- fusiona obras duplicadas;
- deduce hechos narrativos.

Por ello puede utilizarse antes de cualquier evaluación anti-spoilers cuando el
progreso procede de almacenamiento, sincronización o una futura importación.
