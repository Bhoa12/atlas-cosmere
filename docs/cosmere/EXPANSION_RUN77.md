# Expansión Cosmere: run77

Esta iteración añade una frontera reutilizable entre **catálogo bibliográfico** y
**contenido editorial**.

## Modelo

- `verified-index`: respalda títulos y metadatos declarados en un índice.
- `declared-private`: registra una fuente privada sin afirmar que haya sido
  inspeccionada.
- `editorial-accessible`: puede respaldar resúmenes originales únicamente
  cuando también está marcada como accesible.

La capa no asigna mundos, capítulos, cronologías ni hechos narrativos a partir
de títulos. Por tanto, el catálogo puede seguir priorizando Scadrial, Sel,
Nalthis, Taldain, Roshar y futuros mundos sin convertir bibliografía en
contenido editorial.

## Catálogo aportado

El índice verificado de `cosmere.epub` se mantiene como fuente de metadatos
para los títulos declarados por el usuario. Los EPUB privados de Roshar pueden
registrarse como fuentes declaradas, pero esta capa no afirma haber leído sus
pasajes ni infiere su estructura interna.

No se almacena texto íntegro protegido. Los resúmenes futuros deben ser
originales y estar respaldados por material realmente accesible.

## Pruebas

Las pruebas usan datos sintéticos y comprueban que un índice o una fuente
privada no inspeccionada no puede respaldar un resumen editorial, que las obras
sin procedencia conocida se excluyen de la vista de catálogo y que las
declaraciones inconsistentes se detectan.
