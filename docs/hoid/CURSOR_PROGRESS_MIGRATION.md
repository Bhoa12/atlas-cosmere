# Migración transaccional del progreso de Hoid a cursores v2

## Estado

La migración v1 → v2 está implementada en `cursorSqliteProgressStore.ts` y es utilizada por la composición nativa de Atlas. El snapshot v2 es la representación autoritativa después de una migración válida. El registro v1 se conserva como origen inmutable y guardia de divergencia; no se utiliza como fallback.

## Modelo v2

Cada snapshot conserva revisión global, timestamp y una posición por obra:

- Progreso parcial: `{ bookId, cursor, order? }`.
- Finalización declarada: `{ bookId, completed: true, order? }`.

El cursor debe validar contra el manifiesto de la edición exacta. La finalización no se transforma en un capítulo ficticio.

## Secuencia transaccional

1. Inicializar las tablas v1, v2 y de justificantes dentro de una transacción exclusiva.
2. Leer v1, v2 y justificante en una sola transacción exclusiva.
3. Si v2 y justificante existen, validar ambos y comprobar que el payload v1 conservado coincide exactamente con el payload fuente del justificante.
4. Si existe v2 sin justificante, o justificante sin v2, bloquear.
5. Si todavía no existe v2 ni justificante, validar el snapshot v1 completo.
6. Convertir todas las posiciones parciales a cursores exactos. Si una sola no es inequívoca, rechazar toda la migración.
7. Releer v1 dentro de la misma transacción y comprobar versión, revisión y payload.
8. Insertar snapshot v2 y justificante con el payload v1 exacto en la misma transacción.
9. Confirmar ambos cambios juntos; ante una excepción, SQLite revierte la transacción.

El marcador registra versión fuente/destino, revisión fuente, payload exacto y timestamp canónico. La escritura v2 posterior vuelve a validar el marcador y el origen antes del compare-and-swap.

## Política de ambigüedad

- Elantris y Viento y verdad: posiciones numéricas que alcanzan capítulos duplicados se rechazan.
- Arena blanca: no se crean cursores hasta segmentar los volúmenes con índices verificados.
- Arcanum ilimitado: no se infiere un cursor global para la colección.
- Obras desconocidas o posiciones fuera de edición: se rechaza el snapshot legado completo.

No se descartan silenciosamente posiciones ni se reduce el progreso para permitir una migración parcial.

## Divergencia y recuperación

Si un escritor antiguo modifica v1 después de la migración, la lectura y escritura v2 se bloquean con `migration-source-changed`. No se utiliza un snapshot v2 posiblemente obsoleto y tampoco se vuelve automáticamente al v1.

La migración es idempotente. El snapshot v1 se conserva. Los fallos entre la inserción del snapshot y el marcador deben revertirse como una única transacción.

## Verificación

La suite `cursorSqliteProgressStore.test.ts` cubre migración vacía y parcial, finalizaciones, ambigüedad, corrupción, idempotencia, compare-and-swap, marcador huérfano, rollback ante fallo de marcador, concurrencia y divergencia del origen.

La implementación se valida con un doble SQLite transaccional en CI. La prueba de dispositivo Android/iOS, reinicio del proceso e interrupción real de SQLite sigue siendo una condición previa a publicación; no se afirma que se haya ejecutado en hardware.
