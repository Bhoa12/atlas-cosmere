# Run 370 — Persistencia local de recibos editoriales

## Objetivo

Hacer persistentes los resultados de revisión local de resúmenes originales sin almacenar texto narrativo ni permitir que una aprobación local autorice conocimiento de producción.

## Contrato y validación

- `editorialReviewReceiptStore.ts` define el snapshot versionado y el puerto independiente del proveedor.
- `validateHoidEditorialReviewReceiptSnapshot` canonicaliza el snapshot, rechaza propiedades accesorias, arrays dispersos, duplicados, recibos huérfanos y recibos que no coinciden con el paquete editorial actual.
- Cada recibo se vuelve a validar contra el paquete determinista derivado del borrador, la edición, el resumen original y la huella documental registrados.
- El fingerprint es determinista y no sustituye una firma ni autentica al revisor.

El snapshot contiene únicamente:
- versión y revisión monotónica;
- identificador del paquete y del borrador;
- hashes del resumen y del documento fuente;
- decisión local;
- etiqueta local de revisor y fecha;
- checklist y códigos de nota cerrados.

No contiene el resumen, pasajes, localizadores EPUB, rutas, URI ni bytes de documentos.

## Persistencia SQLite

- Tabla singleton: `hoid_editorial_review_receipts_v1`.
- Comparte el handle `atlas-cosmere-hoid.db` administrado por `getExpoHoidDatabase()`.
- No abre ni cierra conexiones adicionales.
- Inicializa el snapshot vacío únicamente si la fila no existe.
- Cada escritura requiere exactamente `next.revision = expectedRevision + 1`.
- Las escrituras se realizan en una transacción exclusiva con parámetros SQL enlazados y comparación de revisión.
- Un escritor obsoleto o una contención `SQLITE_BUSY/SQLITE_LOCKED` devuelve `conflict`.
- Corrupción, versión desconocida o fallo de almacenamiento devuelve `unavailable`; nunca se reemplaza una fila corrupta por valores por defecto.
- No se realizan migraciones implícitas.

## Integración en pantalla

`HoidTrustedScreenHost` carga el snapshot desde el adaptador Expo y lo valida antes de pasarlo a HoidScreen.

La cola editorial se oculta mientras el registro está cargando, si la base de datos no está disponible o si el snapshot no supera la validación. Así, una lectura fallida no convierte revisiones existentes en falsos estados `pending-review`.

La integración actual es de lectura: el puerto SQLite ya soporta compare-and-swap para una futura interfaz editorial, pero esta fase no añade controles que emitan recibos ni afirma que exista una identidad de revisor autenticada.

## Límites de autoridad y spoilers

- Los recibos locales son etiquetas de revisión no autenticadas.
- Una aprobación permanece `approved-awaiting-source-promotion`.
- `promotionAllowed` y `productionWritePerformed` siguen siendo falsos.
- El snapshot no cambia el progreso, no desbloquea spoilers y no autoriza respuestas.
- La elegibilidad visible sigue dependiendo del cursor validado y de la proyección exacta por capítulo.
- No hay egress a proveedores ni acceso a EPUB/XHTML durante la persistencia.

## Privacidad

La tabla conserva metadatos de revisión en el sandbox local de la aplicación. No se afirma cifrado a nivel de base de datos; cualquier requisito de cifrado debe resolverse en la capa del host/dispositivo. Web permanece no disponible hasta disponer de una implementación transaccional revisada.

## Validación

El workflow Run 370 ejecuta:
- regresiones de almacenamiento SQLite: inicialización, persistencia, recarga, CAS concurrente, corrupción, versión desconocida, contención, parámetros enlazados y privacidad;
- regresiones de cola editorial, recibos y cursores;
- TypeScript estricto para el adaptador, fábrica Expo, host y panel.

No se incorporan EPUB, XHTML ni texto protegido al repositorio.
