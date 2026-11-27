# Run 372 — preflight de revisión editorial de resúmenes vinculada a la fuente

## Objetivo

Añadir una comprobación previa, independiente del proveedor y no promotora, para un resumen original que ya tenga una aprobación local. El proceso comprueba que la fuente EPUB exacta está cargada en la sesión local y que su documento XHTML conserva la huella registrada para la edición y capítulo correspondientes.

## Contrato

`createHoidEditorialSummaryPromotionPreflightPort` recibe:
- el puerto de lectura del almacén de recibos locales;
- una función que obtiene el progreso persistido más reciente;
- un puerto de acceso local a documentos EPUB;
- un límite de tiempo acotado para inspeccionar el documento.

La operación `audit({ packetId })`:
1. valida estrictamente el identificador de paquete;
2. lee y valida el progreso actual;
3. lee y valida el snapshot SQLite de recibos;
4. reconstruye el paquete desde el catálogo editorial vigente;
5. exige exactamente un recibo local aprobado para ese paquete;
6. vuelve a proyectar la cola con el cursor validado y exige que el límite de desbloqueo siga alcanzado;
7. compara edición, navegación y huella del documento con el manifiesto y la allowlist exacta;
8. pide al puerto local una inspección acotada del documento XHTML;
9. acepta únicamente el estado y la huella esperada, sin texto ni bytes;
10. vuelve a leer progreso y recibos y descarta el resultado si cualquiera cambió durante la operación.

## Resultado

Un resultado satisfactorio se denomina `ready-for-authenticated-review`, no «aprobado para producción».

Incluye solo identificadores editoriales, libro, capítulo, edición, revisión de progreso, huella del snapshot y un indicador de verificación del documento. No incluye resumen, pasaje, localizador EPUB, digest del documento, ruta, URI ni bytes.

## Límites de autoridad

- El recibo local continúa sin autenticar al revisor.
- La coincidencia del digest demuestra disponibilidad e identidad de bytes, no que una persona haya leído o verificado el pasaje.
- El preflight no crea ni modifica recibos.
- No llama a la autoridad de promoción de producción.
- No modifica el registro de conocimiento aprobado.
- No autoriza respuestas, no cambia progreso y no desbloquea spoilers.
- Una revisión autenticada y la promoción protegida siguen siendo pasos independientes.

## Privacidad y proveedores

El puerto local solo puede devolver `{ status: "available", documentSha256 }` o `{ status: "unavailable", reason }`. Se rechazan propiedades adicionales, incluido cualquier campo que pudiera transportar texto XHTML, bytes, rutas o URI.

No hay egress a proveedores. Las pruebas utilizan puertos sintéticos y no afirman que los EPUB privados estén montados durante CI.

## Validación

El workflow Run 372 ejecuta:
- pruebas del nuevo preflight;
- regresiones de cola editorial, paquetes, recibos SQLite, runtime de cursores y router EPUB local;
- TypeScript estricto para el nuevo contrato, sus pruebas y las fronteras de acceso relacionadas.

El preflight permanece como servicio desacoplado. La composición con sesiones EPUB de la pantalla confiable se realizará por separado; esta ejecución no presenta una integración UI que aún no existe.
