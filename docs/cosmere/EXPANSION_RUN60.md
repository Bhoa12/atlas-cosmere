# Expansión del Cosmere: run 60

Esta iteración añade validación de procedencia y composición conservadora del progreso sobre la infraestructura anterior.

## Límites editoriales

Las fuentes distinguen entre `verified-index` y `declared-private`. Un índice verificado respalda únicamente los metadatos presentes en ese índice. Una fuente privada declarada no implica que su texto, capítulos o pasajes hayan sido inspeccionados.

El catálogo puede registrar los títulos proporcionados para `cosmere.epub` y la colección privada de Roshar como fuentes. Esta capa no infiere mundos, capítulos, unidades ni hechos narrativos a partir de títulos o nombres de archivo.

## Progreso y spoilers

`mergeProgress` solo conserva unidades conocidas de la obra solicitada. Los snapshots de otras obras y las unidades desconocidas se descartan.

`createGate` exige requisitos explícitos, únicos y pertenecientes a la misma obra. Si los metadatos son incompletos o inconsistentes, no crea una puerta. Este comportamiento evita que datos ambiguos amplíen la visibilidad del contenido.

## Contenido

No se almacena texto íntegro, citas extensas ni pasajes de EPUB. Los futuros resúmenes deben ser originales y estar respaldados por material accesible.
