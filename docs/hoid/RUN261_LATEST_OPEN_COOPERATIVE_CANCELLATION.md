# Run 261 — latest-open cooperative cancellation

## Objetivo

Run 258 introdujo `latest-open-wins`: una apertura antigua no puede presentar su capítulo después de que empiece otra. Run 260 añadió una señal de vida para la sesión EPUB. Sin embargo, una apertura anterior podía seguir esperando una lectura durable o una extracción local hasta que el adaptador terminase, aunque su resultado ya no fuese elegible.

Run 261 convierte la sustitución por una apertura más reciente en una cancelación cooperativa de la operación anterior, sin mezclarla con la cancelación explícita del usuario ni con la invalidación de la fuente.

## Contrato de concurrencia

Cada apertura válida obtiene un controlador privado del host. Antes de instalar el nuevo intento, el host marca el intento anterior como `superseded` y aborta su controlador.

La señal efectiva que llega a la ingestión combina:

- `AbortSignal` del llamador, si existe.
- `AbortSignal` de la sesión EPUB, si existe.
- Señal privada del intento, cancelada al comenzar una apertura posterior.

Las señales duplicadas se eliminan antes de enlazarlas. Los listeners añadidos a señales externas se retiran en `finally`. El host solo limpia el intento activo si sigue siendo propietario del slot, de modo que el `finally` de una apertura antigua no pueda borrar la referencia de una apertura nueva.

## Resultados diferenciados

- `cancelled`: cancelación explícita del llamador o invalidación de la sesión/fuente.
- `superseded`: otra apertura válida comenzó después; el host aborta la lectura anterior y conserva esta razón al terminar.
- `stale-progress`: la revisión, fingerprint o epoch del progreso cambió.
- `reader-unavailable`: la sesión/host ya no está vigente.
- `failed`: fallo inesperado no atribuible a cancelación.

Una petición estructuralmente inválida se rechaza antes de reemplazar el intento activo; una entrada malformada no puede cancelar una lectura válida en curso.

## Lecturas durables cancelables

El refresco SQLite inicial y final ahora se espera mediante una barrera cancelable. Si la operación durable no admite cancelación física, el host deja de esperarla y observa su resolución/rechazo tardío. Ningún valor tardío vuelve al pipeline ni puede presentar un capítulo.

Esto es cancelación lógica del consumidor, no una afirmación de que SQLite interrumpa una llamada nativa ya iniciada.

La ingestión EPUB sigue recibiendo la señal combinada y conserva sus propias comprobaciones cooperativas para rangos ZIP, lecturas locales y extracción XHTML. Las operaciones síncronas del parser o de descompresión siguen sin ser preemptibles a mitad de llamada; sus resultados se descartan después si la señal ya está abortada.

## Pruebas de regresión

La suite `epubRecommendationReaderHost.test.ts` añade escenarios para:

1. Una apertura nueva aborta la extracción anterior y la anterior devuelve `superseded`.
2. Una apertura nueva libera al consumidor de una lectura durable pendiente; la resolución tardía se descarta.
3. Los listeners de las señales del llamador y de la sesión se eliminan después de una apertura satisfactoria.

Se mantienen las pruebas de cancelación explícita, cancelación de sesión, latest-open-wins, progreso obsoleto, identidad de edición y validación de localizadores.

## Seguridad, progreso y privacidad

- No se cambia el ledger SQLite ni se confirma progreso.
- Abrir un capítulo sigue siendo distinto de marcarlo como leído o completar la obra.
- No se amplía la autorización narrativa ni el límite de spoilers.
- El fingerprint continúa siendo una identidad de frescura, no una firma ni un permiso.
- No se leen EPUB privados para las pruebas y no se incorpora texto/XHTML protegido al repositorio.
- El texto del lector sigue siendo local y efímero; los fixtures son sintéticos.
- La arquitectura continúa desacoplada del proveedor de IA.

## Validación

La rama ejecuta los workflows existentes de puerto lector e importación EPUB, que incluyen Vitest y TypeScript estricto para el host, ingestión, progreso, navegación y límites de plataforma. No se considera validado el cambio hasta que terminen las ejecuciones del HEAD final.

## Aislamiento

- Base: `feat/hoid-ia-core-run260`.
- Rama: `feat/hoid-ia-core-run261`.
- Los cambios se limitan a la rama de esta iteración.
- No se modifica `main`, no se retargetean PR anteriores y no se fusiona automáticamente.
