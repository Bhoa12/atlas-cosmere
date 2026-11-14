# Expansión Cosmere — Run 72

Esta iteración añade una capa pequeña y reutilizable para **validar metadatos, reconciliar progreso y decidir puertas anti-spoilers**.

## Modelo

`SourceRef → World → Work → ReadingUnit → ProgressSnapshot → SpoilerDecision`.

Las relaciones se almacenan únicamente cuando son explícitas. Un título bibliográfico **no implica** un mundo, una cronología ni una estructura interna.

## Bibliografía y procedencia

El índice verificado de `cosmere.epub` puede alimentar títulos y otros metadatos presentes en ese índice. Los EPUB privados de Roshar pueden registrarse como fuentes declaradas, pero esta capa no afirma que sus capítulos o pasajes hayan sido inspeccionados.

No se copia texto protegido. Los resúmenes futuros deben ser originales y estar respaldados por material accesible.

## Seguridad anti-spoilers

`evaluateSpoilerGate` aplica una política **fail-closed**: un catálogo inválido, requisitos vacíos, requisitos duplicados o unidades desconocidas nunca desbloquean contenido. El progreso de otra obra o de unidades desconocidas se ignora.

Las pruebas usan datos sintéticos y no contienen contenido editorial.
