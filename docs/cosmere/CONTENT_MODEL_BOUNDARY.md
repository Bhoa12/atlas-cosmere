# Frontera del modelo de contenido del Cosmere

Este módulo define una arquitectura técnica reutilizable para conectar mundos, obras, unidades de lectura, progreso y visibilidad anti-spoilers.

## Qué representa

- **WorldRecord**: identidad y nombre de un mundo.
- **WorkRecord**: una obra catalogada con su procedencia; su relación con un mundo es opcional.
- **ReadingUnitRecord**: una unidad técnica ordenada dentro de una obra.
- **ReadingProgress**: unidades que el lector ha marcado como completadas.
- **resolveVisibility**: resuelve `visible` o `locked` exclusivamente a partir de requisitos y progreso.

## Qué no representa

Este módulo no contiene texto de EPUB, citas, capítulos, páginas, resúmenes narrativos, cronologías ni afirmaciones sobre acontecimientos. Tampoco deduce la relación editorial entre una obra y un mundo: cualquier `worldId` debe proceder de metadatos verificados.

La validación es fail-closed: referencias, posiciones o identificadores ambiguos se rechazan; la visibilidad queda bloqueada cuando el progreso es inconsistente.

## Integración

La cadena prevista es:

`fuente con procedencia conocida → obra catalogada → unidad verificada → progreso → requisito de visibilidad`

Los datos editoriales solo deben añadirse cuando exista una fuente accesible y verificable. La bibliografía privada puede aportar títulos y estructura previamente verificados, pero su texto íntegro no se copia ni se publica.
