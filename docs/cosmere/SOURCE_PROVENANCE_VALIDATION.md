# Validación de procedencia bibliográfica

Este documento describe `validateBibliographicSources`, una comprobación estructural del manifiesto de procedencia.

## Garantías técnicas

La validación comprueba:

- identificadores de fuente no vacíos y únicos;
- etiquetas de fuente no vacías;
- títulos no vacíos;
- ausencia de títulos duplicados entre las fuentes declaradas.

Los títulos se comparan después de eliminar espacios exteriores para evitar que una diferencia de formato oculte un duplicado.

## Límite editorial

Esta validación solo comprueba metadatos de procedencia. Un manifiesto válido **no** demuestra que se haya abierto o leído el texto de un EPUB, ni verifica capítulos, resúmenes, hechos narrativos o relaciones entre personajes.

Si una estructura editorial no está accesible o no ha sido verificada, debe permanecer ausente del catálogo en lugar de ser inventada.
