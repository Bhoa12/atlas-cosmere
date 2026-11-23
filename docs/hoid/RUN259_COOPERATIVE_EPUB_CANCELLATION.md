# Run 259 — cancelación cooperativa de lectura EPUB

## Objetivo

Propagar la cancelación de una apertura desde el puerto de navegación hasta la ingestión local, los accesos ZIP por rangos y la extracción XHTML. Run 258 descartaba correctamente los resultados obsoletos, pero una extracción en curso todavía no recibía la señal del llamador.

## Contrato

Las operaciones de lectura aceptan un `AbortSignal` opcional:

- `HoidEpubIngestionService.readChapterContent(candidate, href, signal)`
- `HoidEpubIngestionService.inspectChapterDocument(candidate, href, signal)`
- `HoidEpubArchivePort.listEntries(sourceId, signal)`
- `HoidEpubArchivePort.readEntry(sourceId, path, maximumBytes, signal)`
- `HoidEpubXmlPort.validateXhtml(bytes, signal)`
- `HoidEpubXmlPort.extractReadableBlocks(bytes, signal)`

La cancelación se representa como un rechazo acotado `{ status: "rejected", reason: "cancelled" }`. El host lector transmite la misma señal al servicio de ingestión y convierte ese resultado en `unavailable / cancelled`; nunca presenta bloques parciales.

## Propagación hasta el archivo local

- El adaptador ZIP por rangos transmite la señal al resolver y a cada lectura de rango.
- El proveedor Expo comprueba la señal antes y después de cada lectura de archivo y entre los fragmentos Base64 de 48 KiB. Si se cancela durante un fragmento, ese fragmento puede terminar, pero no se solicita el siguiente.
- La lectura ZIP comprueba la señal antes y después de inspeccionar registros locales, leer miembros y validar CRC.
- La validación y extracción XHTML comprueban la señal en sus fronteras y durante los recorridos estructurales.

## Límite de cancelación

No se afirma una interrupción física dentro de operaciones síncronas que no exponen un punto de cooperación. En particular, `inflateSync`, `DOMParser.parseFromString`, el análisis ZIP del adaptador en búfer y partes síncronas del recorrido del árbol no pueden ser interrumpidos a mitad de llamada en el hilo JavaScript. La señal se comprueba inmediatamente antes y después; si se cancela mientras una de esas operaciones síncronas ocupa el hilo, su resultado se descarta antes de continuar o presentar contenido.

Tampoco se puede interrumpir una llamada nativa `readAsStringAsync` ya iniciada; el proveedor deja de pedir fragmentos adicionales cuando esa llamada retorna.

## Seguridad y privacidad

- Solo se lee el documento XHTML vinculado al candidato de paquete emitido por la misma instancia de ingestión y a la navegación verificada.
- Se mantienen las comprobaciones de identidad de edición, huella de navegación, tamaño, integridad del ZIP y digest del capítulo.
- El texto continúa siendo local y efímero: no se persiste, no se envía al proveedor de Hoid y no se incorpora al registro editorial.
- Cancelar no modifica el ledger ni el progreso.
- Esta capacidad no aprueba afirmaciones narrativas ni amplía el límite de spoilers.

## Pruebas

Los fixtures son sintéticos. Se cubren:

- Señal ya abortada antes de acceder al archivo.
- Cancelación durante la lectura de bytes del capítulo.
- Cancelación durante extracción XHTML asíncrona.
- Ausencia de solicitudes ZIP adicionales después de cancelar una lectura por rangos.
- Detención del proveedor Expo entre fragmentos Base64.
- Propagación de la misma señal desde el host lector hasta el servicio de ingestión.
- Rechazo de validación/extracción XML cuando la señal ya está abortada.

## Validación

Las suites de ingestión offline, adaptadores ZIP, proveedor Expo y puerto lector se ejecutan con TypeScript estricto en los workflows de importación EPUB y navegación de recomendaciones. El estado definitivo se informa tras completar GitHub Actions para el HEAD de Run 259.
