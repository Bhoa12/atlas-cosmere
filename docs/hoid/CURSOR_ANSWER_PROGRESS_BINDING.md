# Run 247 — vinculación de respuestas al snapshot de progreso

## Objetivo

Evitar que una respuesta autorizada con un snapshot v2 se presente accidentalmente junto a otro snapshot de lectura. La garantía se aplica también a consumidores directos del runtime de cursores, fuera del gateway conversacional de HoidScreen.

## Contrato

`HoidCursorAnswerProgressBinding` es un recibo local y versionado:

- `schemaVersion`: versión del contrato del recibo.
- `revision`: revisión del ledger validado.
- `fingerprint`: SHA-256 de la proyección canónica de progreso.

El fingerprint reutiliza exactamente `fingerprintHoidCursorProgressProjection()`, que también utiliza el gateway conversacional y el grafo autorizado. La canonicalización ordena las posiciones por obra y los IDs de obras iniciadas antes de calcular el digest.

## Flujo

1. `HoidCursorEvidenceRuntime` valida el snapshot v2 y crea una única proyección de lectura.
2. El runtime estricto selecciona afirmaciones utilizando únicamente esa proyección.
3. Si la respuesta queda autorizada, la fachada adjunta el recibo generado desde la misma proyección.
4. `HoidVerifiedAnswerPresenter` conserva el recibo al reconstruir el texto y las citas desde los registros editoriales locales.
5. `presentHoidEvidenceAnswer()` compara el recibo con la proyección del snapshot que recibe para presentar.
6. Si la revisión o la huella no coinciden, devuelve `withheld / stale-progress` y no expone texto ni citas.

Un recibo malformado se rechaza como `invalid-answer`. Las respuestas heredadas sin recibo conservan el comportamiento de compatibilidad anterior; el flujo de producción basado en cursores debe conservar el recibo hasta la presentación confiable.

## Límites de confianza

El recibo es una **vinculación de frescura**, no una firma criptográfica, no una atestación del proveedor y no una autorización narrativa. El hash es reproducible por cualquier consumidor que conozca el snapshot. No autentica afirmaciones, revisores, fuentes ni identidad de `evidenceId`.

La autoridad editorial sigue siendo el registro de claims aprobado y `HoidVerifiedAnswerPresenter`. El desbloqueo por obra y capítulo sigue verificándose mediante el presentador confiable. El gateway conversacional conserva su comprobación independiente antes y después del trabajo asíncrono y antes de que HoidScreen confirme el texto en la interfaz.

El recibo no se envía al proveedor, no modifica SQLite, no cambia cursores, no amplía el ámbito de libros y no altera ningún umbral anti-spoiler.

## Pruebas

La cobertura sintética comprueba:

- estabilidad del fingerprint ante reordenación equivalente;
- cambio de huella al cambiar la revisión o una posición bajo la misma revisión;
- aceptación de un recibo ligado al snapshot exacto;
- rechazo de recibos antiguos, malformados, con campos extra o versión desconocida;
- rechazo de getters y trampas de Proxy sin ejecutar getters;
- propagación del recibo por el runtime de cursores y el presentador editorial confiable.

No se utiliza contenido narrativo de los EPUB privados.
