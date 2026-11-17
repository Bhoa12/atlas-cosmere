# Manifiestos y cursores de lectura de Hoid

## Objetivo

Introducir una representación versionada y ligada a la edición para posiciones de lectura, sin cambiar todavía el esquema persistido del Progress Ledger ni el contrato que consume el EvidenceRuntime.

## Modelo de datos

```ts
type HoidReadingCursor = {
  schemaVersion: 1;
  manifestId: string;
  bookId: string;
  unitId: string;
  ordinal: number;
  chapterNumber: number;
};
```

El `manifestId` incorpora el identificador de edición, la obra y el SHA-256 del documento de navegación inspeccionado. Por tanto, un cursor no se puede reutilizar silenciosamente con otra edición.

Los IDs de unidad siguen siendo estructurales, por ejemplo `chapter:012`. Los manifiestos adjuntan un `locatorId` únicamente cuando existe un TOC inspeccionado para esa obra y edición. El localizador se vincula al ID de edición y al SHA-256 del documento de navegación; no almacena títulos de capítulo ni texto narrativo.

## Cobertura disponible

Los manifiestos se generan a partir de `editionStructure.ts`. Los recuentos numéricos permiten representar progreso; los localizadores de procedencia se añaden por separado y solo para TOC accesibles e inspeccionados:

- Obras con secuencia numérica verificada: se enumeran los capítulos numerados del 1 al recuento registrado.
- Elantris: se publica únicamente el prefijo 1–47; los números 48, 51 y 57 permanecen ambiguos.
- Viento y verdad: se publica únicamente el prefijo 1–11; los números 12 y 14 permanecen ambiguos.
- Arena blanca, volúmenes 1–3: no se crean unidades hasta verificar los límites de cada volumen.
- Arcanum ilimitado: no se crea una secuencia global; requiere unidades por obra interna.

`unitScope: numbered-chapters-only` indica expresamente que estos manifiestos no representan prólogos, interludios, epílogos, apéndices ni otras secciones especiales. No se inventan esas unidades. Los localizadores por capítulo actualmente disponibles cubren las cinco novelas del EPUB recopilatorio de Roshar, Danzante del Filo y Esquirla del amanecer. `cosmere.epub` no estaba presente en la Library durante Run 101: sus obras conservan el catálogo y los recuentos previos, pero no reciben localizadores nuevos en esta iteración.

## Validación

`validateHoidReadingCursor()` vuelve a resolver el manifiesto local y compara:

- versión del cursor;
- edición y huella de navegación;
- identificador de obra;
- ID de unidad;
- ordinal;
- número de capítulo.

Rechaza propiedades desconocidas, heredadas, simbólicas, no enumerables y accessors. Las excepciones durante la inspección se contienen. Como cualquier frontera JavaScript, no puede identificar de forma fiable un Proxy transparente; los adaptadores deben decodificar datos externos como JSON antes de validarlos.

## Compatibilidad y migración

`toHoidReadingCursorPositions()` ofrece una proyección paralela del progreso actual de Atlas. La proyección reutiliza primero `toHoidReadingPositions()`, de modo que las políticas de edición existentes siguen siendo obligatorias.

El cursor puede proyectarse al formato legado mediante `cursorToLegacyReadingPosition()`, pero solo después de validar contra el manifiesto.

**No se ha cambiado el Progress Ledger.** El Ledger sigue almacenando posiciones numéricas y el EvidenceRuntime sigue consumiendo `ReadingPosition`. Antes de convertir cursores en la fuente de autorización persistida se requiere una migración explícita de esquema, lectura dual, reconciliación de datos y pruebas de rollback. No se debe inferir un localizador para capítulos duplicados a partir de un entero heredado.

## Pruebas

`readingManifest.test.ts` y `readingCursorAdapter.test.ts` cubren generación, límites ambiguos, rechazo de obras no segmentadas, manipulación de cursores, propiedades no confiables y proyección del progreso de Atlas.

Run 101 inspeccionó únicamente metadatos OPF y documentos de navegación de tres EPUBs únicos de Roshar. No se inspeccionó prosa ni se incorporaron títulos de capítulo. Los localizadores se describen en `docs/hoid/VERIFIED_CHAPTER_LOCATORS.md`.
