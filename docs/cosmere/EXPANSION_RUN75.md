# Expansión Cosmere — Run 75

Esta iteración añade una frontera explícita de capacidades para las fuentes.

## Regla de procedencia

Cada fuente se clasifica como:

- **catalog-metadata**: respalda títulos y otros metadatos declarados, pero no estructura interna ni resúmenes.
- **private-uninspected**: registra una fuente privada declarada sin afirmar que sus pasajes o capítulos hayan sido consultados.
- **editorial-accessible**: puede respaldar estructura inspeccionada y resúmenes originales, siempre sin copiar texto protegido.

La función `sourceCapabilities` convierte esa política en una restricción comprobable por código. `catalogView` expone únicamente títulos declarados y no asigna mundos ni genera contenido editorial.

## Bibliografía

El índice verificado de `cosmere.epub` sigue siendo un catálogo de metadatos. Los EPUB privados de Roshar pueden registrarse como fuentes privadas no inspeccionadas. Esta capa no inventa capítulos, hechos narrativos, relaciones entre obras y mundos ni resúmenes.

## Pruebas

Las pruebas usan únicamente datos sintéticos y comprueban la separación entre índice, fuente privada no inspeccionada y material accesible, además de detectar procedencia incoherente.
