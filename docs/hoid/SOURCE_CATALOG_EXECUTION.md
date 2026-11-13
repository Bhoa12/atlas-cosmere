# Hoid IA: catálogo de fuentes ejecutable

`src/hoid/sourceCatalog.ts` representa únicamente bibliografía y estructura de lectura. No contiene pasajes, citas extensas ni hechos narrativos.

## Regla de cobertura

- `catalog_only`: conocemos el título como metadato.
- `structure_verified`: podemos representar progreso y orden de lectura.
- `summary_backed`: existe un resumen original respaldado por evidencia autorizada.
- `unavailable`: la fuente o la parte necesaria no está disponible.

La pertenencia al catálogo **no** autoriza por sí sola ninguna afirmación narrativa. La función `isNarrativeEvidenceAvailable` falla de forma cerrada y solo acepta `summary_backed`.

## Integración

El catálogo debe alimentar la normalización de obras y progreso. La capa de recuperación/evidencia debe elevar la cobertura únicamente cuando exista respaldo permitido. Un proveedor nunca debe interpretar `structure_verified` como acceso al contenido de un EPUB.

Esta separación mantiene el flujo:

`catálogo → progreso → presupuesto → contexto autorizado → proveedor → verificación → filtro`

sin copiar ni transportar texto protegido de las fuentes privadas.
