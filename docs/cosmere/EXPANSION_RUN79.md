# Expansión Cosmere — Run 79

Esta iteración añade una política reutilizable para conectar fuentes, unidades de lectura, progreso y puertas anti-spoilers sin convertir el catálogo bibliográfico en estructura editorial.

## Regla de procedencia

Una unidad de lectura solo puede considerarse válida si su fuente tiene acceso `editorial-accessible`. Las fuentes `catalog-metadata` y `private-uninspected` pueden registrar bibliografía, pero no autorizan a inventar capítulos, secciones ni resúmenes.

## Progreso

Los snapshots se reconcilian por obra. Se ignoran unidades desconocidas, duplicados y snapshots de otras obras. El resultado se ordena únicamente mediante posiciones explícitas.

## Anti-spoilers

Las puertas usan una política *fail-closed*: se bloquean ante requisitos vacíos, duplicados o desconocidos, estructura de lectura sin procedencia suficiente o progreso incompleto.

## Catálogo de fuentes

El índice verificado de `cosmere.epub` puede utilizarse para registrar los títulos declarados por el usuario: la primera y segunda era de Mistborn presentes en ese índice, El aliento de los dioses, Elantris, Arena blanca vol. 1–3, Trenza del mar Esmeralda, Yumi y el pintor de pesadillas, El Hombre Iluminado, Islas de la ascuaoscura y Arcanum ilimitado.

Los EPUB privados de Roshar pueden mantenerse como fuentes declaradas, incluidas las cinco novelas principales, Danzante del Filo y Esquirla del amanecer, sin afirmar que sus pasajes o su estructura interna hayan sido inspeccionados.

Esta capa no copia texto protegido ni añade hechos narrativos. Los futuros resúmenes deben ser originales y estar respaldados por material realmente accesible.
