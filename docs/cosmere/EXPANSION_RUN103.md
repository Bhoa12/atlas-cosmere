# EXPANSION RUN 103

## Objetivo

Añadir una auditoría transversal de integridad para el catálogo de Atlas del Cosmere sin ampliar artificialmente el contenido editorial.

## Modelo

La capa conecta, mediante referencias explícitas:

- fuentes;
- obras;
- mundos;
- relaciones obra-mundo.

También informa de obras sin relación declarada. Un hueco de cobertura **no se rellena mediante inferencia**.

## Procedencia

Los tipos de fuente se mantienen separados:

- `verified-index`: metadatos bibliográficos respaldados por un índice verificado;
- `declared-private`: fuente registrada pero no tratada como texto editorial accesible;
- `editorial-accessible`: fuente explícitamente accesible para estructura de lectura o resúmenes originales.

La política para estructura de lectura y resúmenes es fail-closed: solo una fuente editorial accesible puede autorizarlos.

## Bibliografía

El catálogo puede registrar los títulos aportados por el usuario, incluidos los títulos de `cosmere.epub` y los EPUB privados de Roshar, sin copiar texto protegido ni afirmar que se han inspeccionado pasajes no accesibles.

## Pruebas

Las pruebas usan datos sintéticos y verifican:

1. detección de obras sin relación declarada;
2. rechazo de referencias desconocidas y relaciones duplicadas;
3. separación entre metadatos y contenido editorial.
