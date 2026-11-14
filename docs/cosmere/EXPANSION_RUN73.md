# Expansión Cosmere — Run 73

## Objetivo

Esta iteración añade una frontera explícita entre el catálogo bibliográfico, la procedencia de un resumen original y su visibilidad anti-spoilers.

## Regla de procedencia

Un índice verificado puede respaldar metadatos como títulos, pero no autoriza por sí solo a almacenar un resumen narrativo. Las fuentes privadas declaradas tampoco se consideran inspeccionadas automáticamente.

Un resumen solo puede declararse cuando su fuente está registrada explícitamente como `accessible`. La aplicación conserva el texto como contenido original de la aplicación; no almacena pasajes de EPUB.

## Visibilidad

La función `evaluateContentVisibility` combina:

1. validación estructural del catálogo;
2. validación de la procedencia del contenido;
3. la puerta de lectura explícita de Run 72.

Cualquier fallo bloquea el contenido. No se infieren capítulos, mundos, cronologías ni hechos narrativos.

## Catálogo

La bibliografía aportada continúa siendo un catálogo de fuentes. Esta capa es reutilizable para Scadrial, Sel, Nalthis, Taldain, Roshar y futuros mundos, pero no asigna relaciones editoriales automáticamente.

## Pruebas

Las pruebas usan únicamente obras y resúmenes sintéticos. Cubren resúmenes sin fuente accesible, requisitos de lectura incompletos y declaraciones falsas de accesibilidad.
