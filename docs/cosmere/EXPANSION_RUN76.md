# EXPANSION RUN76

## Objetivo

Esta iteración añade una frontera explícita entre **estructura de lectura respaldada** y **progreso del usuario**.

## Regla de procedencia

Una unidad de lectura solo es estructuralmente válida cuando procede de una fuente marcada como `editorial-accessible`. Un índice bibliográfico o un EPUB privado declarado pero no inspeccionado puede seguir existiendo en el catálogo, pero no se transforma automáticamente en capítulos o unidades.

## Progreso

`reconcileProgress` acepta varios snapshots, ignora obras ajenas y descarta identificadores de unidad desconocidos. El resultado se ordena únicamente con posiciones declaradas.

## Anti-spoilers

`evaluateSpoilerPolicy` es *fail-closed*: bloquea ante estructura inválida, requisitos vacíos, requisitos duplicados o unidades desconocidas. Solo devuelve contenido visible cuando todas las unidades requeridas y explícitamente válidas están completadas.

## Alcance bibliográfico

Scadrial, Sel, Nalthis, Taldain, Roshar y otros mundos pueden utilizar esta capa sin asumir relaciones editoriales. Los títulos del índice verificado siguen siendo metadatos de catálogo. No se ha copiado texto protegido ni añadido hechos narrativos.
