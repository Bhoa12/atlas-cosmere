# Run 249 — suscripción a cambios de progreso y cancelación cooperativa

## Objetivo

Añadir un puerto opcional y desacoplado de proveedor para que el gateway pueda cancelar trabajo en curso cuando el coordinador del ledger confirme un cambio de progreso. La comparación autoritativa posterior se conserva como garantía obligatoria.

## Contrato

`HoidProgressChangeSubscription` recibe un listener sin payload narrativo y devuelve una función de desuscripción. El adaptador real debe emitir el evento **solo después** de confirmar durablemente la nueva revisión del ledger.

El evento no contiene IDs de afirmaciones, capítulos, nombres de personajes ni texto de fuentes. Su única semántica es invalidar el trabajo ligado al snapshot anterior.

## Secuencia de ejecución

1. El gateway valida el snapshot solicitado y lee el progreso autoritativo.
2. Antes de invocar al runtime, instala la suscripción.
3. Tras instalarla, vuelve a leer el progreso durable. Esta segunda lectura cierra la ventana en la que un commit podría ocurrir entre la primera lectura y el alta del listener.
4. Si el progreso cambió o la suscripción no puede instalarse, no se invoca al runtime.
5. Si el ledger emite un cambio durante la llamada, el gateway aborta el `AbortSignal` derivado y marca la operación como obsoleta.
6. Aunque el proveedor ignore la señal y devuelva una respuesta, el gateway descarta el resultado completo.
7. Se elimina siempre la suscripción. La lectura autoritativa posterior a la operación continúa siendo obligatoria.

## Integración con proveedores

El puerto no depende de ningún SDK. El adaptador de cada proveedor recibe únicamente `HoidRuntimeCallOptions.signal` y puede traducirlo a la cancelación de su transporte. La seguridad no depende de que el proveedor respete esa señal: el gateway conserva la invalidación local y la comprobación posterior.

## Integración con el coordinador SQLite

`HoidCursorProgressCoordinator` expone `subscribe(listener)`. Emite un evento sin payload:
- después de que `compareAndSwap` haya confirmado un avance o finalización;
- cuando `refresh()` descubre una revisión durable distinta escrita por otro coordinador.

No emite en inicialización, escrituras sin cambios ni fallos de almacenamiento. Las excepciones de listeners se aíslan para que nunca alteren un commit ya confirmado. La desuscripción es idempotente.

`CosmereContext` expone el puerto al lector y `HoidScreen` lo inyecta en `HoidConversationGateway`. Así, los cambios locales del coordinador cancelan de forma cooperativa las respuestas y recomendaciones en curso. Un cambio de otro proceso se detecta al refrescar el snapshot; no se afirma que SQLite proporcione una notificación cross-process espontánea.

`subscribeToProgressChanges` sigue siendo opcional para otros hosts. Si no se proporciona, se conserva el control before/after. Si se configura y falla el alta o la segunda lectura durable, la operación se retiene con `invalid-progress`.

## Cobertura

- Evento durante una respuesta: el signal se aborta y la respuesta se descarta aunque el proveedor lo ignore.
- Evento durante una recomendación: mismo comportamiento.
- Cambio entre el alta de la suscripción y la segunda lectura: no se invoca al proveedor.
- Fallo al instalar la suscripción: cierre seguro.
- Limpieza de la suscripción al completar la operación.
- El tipo-check de la suite principal corrige dos fixtures heredados: un snapshot de finalización explícita tipado demasiado estrechamente y un mock sin parámetro que luego inspeccionaba.

## Privacidad y spoilers

Las pruebas usan snapshots y entidades sintéticas. No se leen EPUBs ni XHTML, no se incorporan pasajes protegidos y no se generan afirmaciones narrativas. La bibliografía metadata-only no cambia.

## Aislamiento

- Base: `feat/hoid-ia-core-run248`.
- Rama: `feat/hoid-ia-core-run249`.
- PR #141 permanece sin modificar.
- No se escribe en `main` ni se fusiona ninguna rama.
