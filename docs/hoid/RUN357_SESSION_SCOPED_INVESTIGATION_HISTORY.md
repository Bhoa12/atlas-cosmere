# Run 357 — historial de investigación contextual por sesión

## Objetivo

Registrar qué investigaciones de evolución de personajes han terminado correctamente durante la sesión actual de Hoid y evitar que las sugerencias repitan dimensiones ya consultadas dentro del mismo ámbito de lectura.

## Contrato

- `createHoidInvestigationSession()` crea un registro efímero, en memoria y desacoplado de proveedores.
- Cada envío obtiene un ticket de identidad; un envío posterior lo sustituye.
- Solo el ticket vigente puede registrar una investigación completada.
- La pantalla registra una consulta únicamente después de que el adaptador local devuelva `ready` y la comprobación final de progreso confirme que la respuesta sigue siendo válida justo antes de incorporarla al chat.
- Se registra el tema `overview` o una de las ocho dimensiones de evolución.
- Las sugerencias se filtran por sujeto canónico, dimensión, revisión y huella del progreso, y ámbito exacto de libro.
- Una dimensión ya completada se omite de las sugerencias posteriores para el mismo sujeto y ámbito.
- El registro está limitado a 64 entradas y elimina primero la más antigua.
- Cambiar el progreso, el foco o el ámbito reinicia el historial de esta sesión.

## Minimización de datos y privacidad

El registro conserva únicamente:
- Huella SHA-256 del nombre canónico del sujeto.
- Dimensión consultada.
- Revisión y huella del progreso.
- Huella del ámbito de lectura.
- Secuencia local de finalización.

No conserva:
- Preguntas originales.
- Respuestas ni resúmenes.
- Texto EPUB/XHTML.
- Identificadores de evidencia.
- Localizadores de fuente.
- Datos de proveedor.
- Historial persistente en SQLite, almacenamiento local, archivos o nube.

La huella del nombre es seudonimización, no anonimización criptográfica. El registro solo vive mientras vive la instancia de pantalla y se borra al invalidar el progreso o el ámbito.

## Semántica

- Enviar una pregunta no equivale a investigarla.
- Una sugerencia preparada en el compositor no equivale a una consulta enviada.
- Una respuesta fallida, bloqueada, cancelada, obsoleta o no verificable nunca se registra como completada.
- Una pregunta general registra `overview`, pero no marca como investigadas las ocho dimensiones.
- Las recomendaciones solo se suprimen cuando coinciden sujeto, dimensión, progreso y ámbito.
- La selección de una sugerencia sigue requiriendo el envío explícito y la ruta conversacional normal.

## Límites

Este primer adaptador registra consultas de evolución de personajes. No pretende ser todavía un historial global de todas las consultas de Hoid, ni deduce que el lector haya comprendido o retenido una explicación. Las demás familias de consulta podrán adoptar el mismo contrato cuando expongan identidades canónicas y estados de finalización equivalentes.

## Validación

El workflow dedicado ejecuta las pruebas del ledger, evolución de personajes, reconocimiento de intención y adaptadores adyacentes, además de TypeScript estricto sobre el módulo, sus pruebas y HoidScreen.

No se añaden afirmaciones narrativas ni se consultan o copian pasajes protegidos.
