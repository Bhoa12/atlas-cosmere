# Expansión del catálogo de lectura

La capa `sourceSafeReading` separa fuentes, mundos, obras, unidades de lectura, progreso y puertas anti-spoilers.

## Procedencia

- `verified-index`: respalda únicamente metadatos presentes en un índice verificado.
- `declared-private`: registra una fuente privada sin afirmar que se haya inspeccionado su contenido interno.

El catálogo semilla incorpora exclusivamente los títulos proporcionados del índice de `cosmere.epub`. Los mundos prioritarios son registros de navegación; esta capa no infiere relaciones obra–mundo.

## Lectura y spoilers

Las unidades de lectura se mantienen vacías hasta disponer de estructura accesible y verificable. `canReveal` usa una política *fail-closed*: si falta progreso, hay requisitos vacíos o duplicados, o una unidad no pertenece a la obra, el contenido permanece bloqueado.

## Límites editoriales

No se almacena texto íntegro, pasajes ni citas extensas de EPUB. Los resúmenes futuros deben ser originales y estar respaldados por material accesible. La ausencia de acceso a un pasaje no autoriza a inventar hechos ni a afirmar que se ha consultado.
