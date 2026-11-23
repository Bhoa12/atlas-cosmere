# Run 260 — cancelación vinculada a la sesión de fuente

## Problema

Run 259 propagó la señal del llamador hasta el proveedor Expo y la ingestión, pero la vigencia del lector seguía dependiendo principalmente de que HoidScreen mantuviera vivo el controlador de apertura. Al liberar o sustituir una fuente, el panel podía iniciar la liberación del archivo antes de invalidar explícitamente la sesión lectora que estaba usando esa fuente.

Además, `awaitWithSignal()` comprobaba la señal antes y después de esperar un puerto asíncrono, pero no permitía que la operación llamadora terminase mientras un adaptador defectuoso o no cooperativo permaneciera pendiente.

## Contrato de sesión

- Cada host lector recibe un `sessionSignal` opcional, propiedad del ciclo de vida de la fuente/edición seleccionada.
- El host combina ese señal con el `AbortSignal` de cada apertura.
- La cancelación del llamador y la invalidación de la sesión producen la misma señal efectiva para la ingestión.
- Los listeners de composición se eliminan en `finally`, también cuando la apertura termina por error o rechazo temprano.
- Al cambiar de EPUB, cambiar de obra/edición, liberar la fuente o desmontar el panel, la sesión se aborta antes de liberar el archivo o publicar un nuevo lector.
- La generación latest-open-wins y las comprobaciones de progreso siguen siendo barreras independientes. Cancelar no sustituye la comprobación de frescura ni modifica el ledger.

## Espera asíncrona cancelable

`awaitWithSignal()` ahora se resuelve o rechaza al recibir `abort`, aunque un puerto inyectado no respete la señal y su promesa continúe pendiente. La promesa subyacente permanece observada para consumir una resolución o rechazo tardío; su resultado nunca reentra en el pipeline cancelado.

Esto no equivale a interrumpir físicamente un adaptador que ignora `AbortSignal`. La cancelación cooperativa del trabajo interno sigue dependiendo del adaptador. La nueva garantía es que el llamador no queda bloqueado y que el resultado tardío se descarta.

## Pruebas

- La apertura del host combina la señal del llamador con la señal de la sesión.
- Invalidar la sesión aborta la señal efectiva que recibió la ingestión.
- Una extracción cancelada no llama a `onChapterOpened`.
- La ingestión devuelve `cancelled` sin esperar una promesa de `listEntries()` que deliberadamente ignora `AbortSignal`.
- La promesa subyacente permanece observada y puede terminar después sin producir un rechazo no gestionado.
- Los workflows de puerto lector e importación EPUB incluyen el nuevo documento y ejecutan las suites afectadas con TypeScript estricto.

## Privacidad y spoilers

- No se inspeccionan EPUB privados durante CI.
- Los fixtures son sintéticos.
- El texto leído sigue siendo local y efímero.
- Cancelar o invalidar una sesión no avanza el progreso, no completa una obra y no autoriza afirmaciones narrativas.
- El catálogo metadata-only y los límites editoriales permanecen sin cambios.
