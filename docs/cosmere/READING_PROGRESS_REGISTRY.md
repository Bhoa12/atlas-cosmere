# Registro reutilizable de lectura y spoilers

Este módulo mantiene separadas las capas de **fuente**, **mundo**, **obra**, **unidad de lectura**, **progreso** y **puerta anti-spoilers**.

## Procedencia

- `verified-index` respalda únicamente metadatos presentes en un índice verificado.
- `declared-private` registra una fuente privada sin afirmar que su contenido interno haya sido inspeccionado.

Los títulos del catálogo no autorizan por sí solos a inferir mundo, capítulos, relaciones narrativas ni otros hechos editoriales.

## Unidades de lectura

Las unidades deben añadirse solo cuando su estructura esté explícitamente disponible. El módulo no genera capítulos ni divisiones a partir de títulos o nombres de archivo.

## Anti-spoilers

`canReveal` es **fail-closed**: cualquier ausencia de progreso, requisito vacío o duplicado, unidad inexistente o unidad perteneciente a otra obra mantiene el contenido oculto.

## Contenido

Los resúmenes visibles deben ser originales y respaldados. No se almacenan pasajes, citas extensas ni texto íntegro protegido. Si un pasaje no está accesible, no debe inventarse contenido ni afirmarse que se ha consultado.
