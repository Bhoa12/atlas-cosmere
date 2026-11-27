# Run 373 — compatibilidad del contrato de acceso documental

## Objetivo

Mantener `src/hoid/editorialSourceDocumentAccess.ts` como definición canónica y provider-neutral del puerto de acceso a un capítulo, sin romper los consumidores que históricamente importaban sus tipos desde `editorialClaimPromotionPreflight.ts`.

## Cambio

`editorialClaimPromotionPreflight.ts` conserva su importación interna y vuelve a exportar explícitamente:

- `HoidEditorialSourceDocumentAccessPort`
- `HoidEditorialSourceDocumentAccessRequest`

Es una reexportación exclusivamente de tipos. No crea una segunda definición, no añade código de ejecución, no cambia el adaptador EPUB y no altera los límites de autoridad del preflight.

## Motivo

La extracción del contrato en Run 372 dejó de exponer accidentalmente esos dos tipos a consumidores existentes. Las suites de Vitest seguían pasando, pero tres workflows de regresión fallaban durante TypeScript estricto con TS2459.

## Verificación

La prueba de compatibilidad importa ambos tipos desde la ruta canónica y desde la ruta histórica y exige asignabilidad estructural en ambas direcciones. El workflow de Run 373 compila además los consumidores EPUB y HoidScreen.

## Seguridad

- Sin acceso adicional a fuentes privadas.
- Sin texto XHTML, EPUB, localizadores, rutas ni URI.
- Sin proveedor remoto ni egress.
- Sin escritura de producción, promoción editorial ni autorización de spoilers.
- Sin cambios de progreso.

## Aislamiento

- Rama: `feat/hoid-ia-core-run373`
- Base: `feat/hoid-ia-core-run372`
- PR en borrador; no fusionar automáticamente.
- `main` no es destino.
