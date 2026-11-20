# Run 173 — reparación del contrato readonly del catálogo

## Hallazgo

La validación de Run 172 ejecutó correctamente las tres suites de pruebas específicas (29/29), pero falló la comprobación TypeScript estricta del workflow `hoid-catalog-evidence-unlock`.

Error exacto:

`src/hoid/authorizedKnowledgeContext.ts(25,36): TS2345: readonly ReadingPosition[] no es asignable a ReadingPosition[]`.

La ruta que originaba el conflicto era:

1. `HoidService` valida y congela el progreso antes de cruzar la frontera del proveedor.
2. `buildAuthorizedKnowledgeContext` recibe ese snapshot como `readonly ReadingPosition[]`.
3. `HoidKnowledgeCatalog.entriesForContext` todavía declaraba un parámetro mutable `ReadingPosition[]`.

El catálogo no mutaba el array; su contrato era innecesariamente más restrictivo que el uso real.

## Corrección

- `entriesForContext` acepta ahora `readonly ReadingPosition[]`.
- El alias de compatibilidad `isUnlocked` acepta también progreso readonly, manteniendo la misma semántica de primera aparición.
- No se introduce ninguna copia mutable ni se modifica el snapshot del lector.
- Se añade una regresión que pasa un array y un elemento congelados, tipados como `readonly ReadingPosition[]`, tanto a `entriesForContext` como a `buildAuthorizedKnowledgeContext`.

## Garantías conservadas

- La primera aparición y el desbloqueo del resumen completo siguen siendo límites independientes.
- `entriesForContext` sigue exigiendo procedencia verificada, resumen original no vacío, localizador de edición y watermark explícito.
- El capítulo citado sigue procediendo de `evidenceSource`.
- La validación del progreso contra la edición ocurre antes de invocar al proveedor.
- No se relajan las reglas de spoilers ni se modifica el runtime estricto.

## Validación

En el HEAD de Run 172, las pruebas del workflow fueron 29/29 satisfactorias. El type-check falló únicamente por el contrato mutable descrito arriba.

Este Run añade una prueba específica de readonly y requiere una nueva ejecución del workflow sobre el HEAD final de Run 173. No se considera validado hasta que esa ejecución y las demás comprobaciones aplicables terminen correctamente.

## Bibliografía, privacidad y producción

No se inspeccionan EPUBs ni se incorporan resúmenes o afirmaciones narrativas. No se modifica el progreso de lectura, el catálogo de fuentes, el allowlist de documentos, los recibos editoriales ni el registro de conocimiento de producción.

No se sube texto protegido, EPUB, XHTML, pasajes, rutas privadas ni URIs locales.

## Aislamiento

- Base exacta: `1a33c3c1d0f9243e238375afb42a94ea5f9d2f96` (Run 172).
- Rama independiente: `feat/hoid-ia-core-run173`.
- PR en borrador; no fusionar automáticamente.
- `main` y todas las ramas anteriores permanecen intactas.
