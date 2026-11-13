# Expansión Cosmere: catálogo y puertas de lectura

## Objetivo

Esta capa proporciona un modelo reutilizable para **fuentes, mundos, obras, unidades de lectura, progreso y puertas anti-spoilers**.

## Procedencia

- `verified-index`: respalda únicamente metadatos presentes en un índice verificado.
- `declared-private`: registra una fuente privada declarada sin afirmar que su texto interno haya sido inspeccionado.

## Límites editoriales

El modelo no almacena texto de EPUB, citas ni pasajes. Tampoco infiere pertenencia a mundos, cronología, capítulos o hechos narrativos a partir de títulos o nombres de archivos.

Las asignaciones `work.worldId` son opcionales y solo deben añadirse cuando exista metadato explícito respaldado.

## Anti-spoilers

`canReveal` funciona en modo **fail-closed**: bloquea contenido cuando los requisitos están vacíos o duplicados, el progreso corresponde a otra obra, falta una unidad o una unidad pertenece a otra obra.

## Catálogo

El archivo `sourceCatalogueRun47.ts` incorpora únicamente los títulos del índice verificado de `cosmere.epub` como metadatos. La colección privada de Roshar se registra como fuente declarada sin enumerar contenido interno no verificado.

Las unidades de lectura futuras deben añadirse como metadatos explícitos y ordenados; no se generan capítulos automáticamente.
