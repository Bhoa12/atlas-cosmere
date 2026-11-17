# Runtime estricto de Hoid en la aplicación

## Ruta de producción

`HoidScreen` utiliza `HoidCursorEvidenceRuntime`, compuesto a partir de `createHoidEditorialRuntime()`. Recibe el snapshot v2 que expone `CosmereContext` y lo vuelve a validar contra los manifiestos de edición antes de consultar el runtime estricto de evidencias.

Los mapas numéricos de Atlas son solo de presentación. La pantalla no importa `progressAdapter.ts` ni reconstruye un segundo progreso numérico. Una solicitud con snapshot inválido se bloquea antes de invocar al selector.

El selector solo devuelve IDs de afirmaciones candidatas ya autorizadas. La prosa final procede del registro editorial local; el proveedor no puede redactar ni ampliar el contenido.

## Estado editorial actual

`editorialRegistry.ts` no contiene entradas de conocimiento ni afirmaciones aprobadas porque no hay nuevos pasajes privados accesibles para verificación en esta integración. Por ello, Hoid se abstiene explícitamente y no recurre a un modelo libre ni a conocimiento argumental genérico.

## Incorporación de material editorial

Cada entrada debe incluir:

- obra y edición verificadas;
- capítulo y localizador opaco de la evidencia;
- umbral independiente de desbloqueo del resumen completo;
- resumen original, no copiado;
- procedencia y estado de revisión.

Cada afirmación aprobada debe ser prosa editorial original, tener revisión identificable y referenciar una o más evidencias. Las afirmaciones entre obras solo se autorizan si todas sus evidencias están desbloqueadas para el progreso actual.

## Requisitos de regresión

- Snapshot v2 inválido: bloquear antes del selector.
- Manifiesto obsoleto o cursor ambiguo: bloquear.
- Registro vacío: abstenerse.
- Sin candidatos autorizados: no invocar al selector.
- Salida del selector: aceptar IDs candidatos únicamente.
- Prosa final: renderizar desde el registro local.
- No restaurar la ruta legacy de texto libre como fallback.
