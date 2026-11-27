# Run 369 — Cola editorial de resúmenes vinculada al progreso

## Objetivo

Dar visibilidad al estado de revisión de los resúmenes editoriales originales sin mostrar contenido narrativo adelantado y sin convertir una revisión local en una autorización de producción.

## Contrato

`projectHoidEditorialSummaryReviewQueue(drafts, receipts, cursorProgressSnapshot)` devuelve una proyección inmutable de metadatos.

- Valida el snapshot v2 con `projectHoidCursorProgressSnapshot`.
- Reutiliza `buildHoidEditorialReviewPackets` y `validateHoidEditorialReviewReceipt`; no duplica el formato de revisión.
- Une cada recibo con un único `packetId`; rechaza recibos duplicados, huérfanos o incompatibles.
- Devuelve solo identificadores de borrador/paquete, obra, capítulo, edición, estado y metadatos mínimos de revisión.
- No devuelve resumen, pasaje fuente, localizador, digest documental, ruta, URI ni texto de notas.

## Regla de progreso y spoilers

El cursor de Atlas en el capítulo N acredita únicamente hasta N-1. Por tanto, una referencia del capítulo N no aparece hasta que el cursor avanza a N+1 o la obra consta explícitamente como completada.

Los borradores no alcanzables se omiten por completo. La respuesta no incluye número de borradores retenidos, placeholders ni recuentos de capítulos futuros. Si el snapshot no se valida, la cola no se muestra.

## Estados editoriales

- `pending-review`: no existe recibo.
- `approved-awaiting-source-promotion`: recibo local válido; todavía requiere la autoridad de promoción protegida.
- `revision-required`: el recibo solicita cambios.
- `rejected`: revisión local rechazada.

La identidad indicada en un recibo local no está autenticada. Incluso una decisión local aprobatoria conserva `promotionAllowed: false` y `productionWritePerformed: false`.

## Privacidad y límites

- No lee EPUB ni XHTML y declara `localAvailability: not-audited`.
- No incluye resúmenes ni texto de fuentes.
- No realiza egress a proveedores.
- No cambia el progreso.
- No desbloquea spoilers.
- No autoriza respuestas.
- No escribe conocimiento de producción.

La interfaz muestra únicamente referencias de capítulos que el snapshot validado ya permite considerar completados. El módulo admite recibos como entrada, pero esta integración de pantalla no conecta todavía un almacén persistente de recibos; por ello, el panel actual presenta los borradores visibles como pendientes de revisión.

## Validación

El workflow Run 369 ejecuta:
- La nueva matriz de progreso, unión de recibos, integridad, privacidad y omisión de capítulos futuros.
- Las regresiones de paquetes editoriales y cursor.
- TypeScript estricto para el módulo, componente y HoidScreen.

No se incorporan EPUB, XHTML ni pasajes protegidos al repositorio.
