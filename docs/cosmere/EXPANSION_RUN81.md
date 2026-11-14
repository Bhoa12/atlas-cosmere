# Expansión Cosmere — Run 81

Esta iteración añade validación reutilizable de integridad para separar catálogo, relaciones entre mundos y obras, y estructura de lectura.

## Principios

- El índice verificado sirve como procedencia de metadatos, no como prueba de capítulos o contenido narrativo.
- Una relación obra-mundo solo existe cuando se declara explícitamente.
- Las unidades de lectura requieren una fuente `editorial-accessible` marcada como accesible.
- La arquitectura no deduce mundos, capítulos ni hechos narrativos a partir de títulos.

## Nuevos helpers

- `validateCatalog`: detecta referencias inválidas, posiciones duplicadas y estructura de lectura sin procedencia suficiente.
- `worldsForWork`: navega únicamente relaciones explícitas.
- `safeReadingUnits`: devuelve unidades con procedencia apta para representar progreso.

Las pruebas usan datos sintéticos. No se incorpora texto protegido ni se afirma haber inspeccionado pasajes privados no accesibles.
