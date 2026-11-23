# Run 247 — vinculación de respuestas a la proyección de progreso

## Objetivo

Evitar que una respuesta autorizada con una proyección de lectura se presente accidentalmente junto a otra proyección. La garantía cubre también consumidores directos del runtime de cursores, fuera del gateway conversacional de HoidScreen.

## Contrato

`HoidCursorAnswerProgressBinding` es un recibo local y versionado:

- `schemaVersion`: versión del contrato del recibo.
- `revision`: revisión del ledger validado.
- `fingerprint`: SHA-256 de la proyección canónica de progreso.

El fingerprint reutiliza exactamente `fingerprintHoidCursorProgressProjection()`, compartido con el gateway conversacional y el grafo autorizado. La canonicalización ordena las posiciones por obra y los identificadores de obras iniciadas antes de calcular el digest.

El fingerprint representa la identidad funcional de la proyección —revisión, posiciones completadas y obras iniciadas—, no un hash byte-a-byte del objeto SQLite completo.

## Flujo

1. `HoidCursorEvidenceRuntime` valida el snapshot v2 y crea una proyección de lectura canónica.
2. El runtime estricto selecciona afirmaciones utilizando únicamente esa proyección.
3. Si la respuesta queda autorizada, la fachada adjunta el recibo generado desde la misma proyección.
4. `HoidVerifiedAnswerPresenter` conserva el recibo al reconstruir el texto y las citas desde los registros editoriales locales.
5. `presentHoidEvidenceAnswer()` compara el recibo con la proyección derivada del snapshot recibido para presentar.
6. Si la revisión o la huella no coinciden, devuelve `withheld / stale-progress` y no expone texto ni citas.

Un recibo malformado se rechaza como `invalid-answer`. Las respuestas heredadas sin recibo conservan el comportamiento de compatibilidad anterior; el flujo de producción basado en cursores debe conservar el recibo hasta la presentación confiable.

## Límites de confianza

El recibo es una **vinculación de frescura**, no una firma criptográfica, no una atestación del proveedor y no una autorización narrativa. El hash es reproducible por cualquier consumidor que conozca la proyección. No autentica afirmaciones, revisores, fuentes ni la identidad de `evidenceId`.

La autoridad editorial sigue siendo el registro de afirmaciones aprobado y `HoidVerifiedAnswerPresenter`. El desbloqueo por obra y capítulo sigue verificándose mediante el presentador confiable. El gateway conversacional conserva su comprobación independiente antes y después del trabajo asíncrono y antes de que HoidScreen confirme el texto en la interfaz.

El recibo no se envía al proveedor, no modifica SQLite, no cambia cursores, no amplía el ámbito de libros y no altera ningún umbral anti-spoiler.

## Pruebas

La cobertura sintética comprueba:

- estabilidad del fingerprint ante reordenaciones equivalentes;
- cambio de huella al cambiar la revisión o una posición bajo la misma revisión;
- aceptación de un recibo ligado a la proyección exacta validada;
- rechazo de recibos antiguos, malformados, con campos adicionales o versiones desconocidas;
- rechazo de getters y trampas de Proxy sin ejecutar getters;
- propagación del recibo por el runtime de cursores y el presentador editorial confiable;
- ausencia del recibo en la solicitud enviada al selector/proveedor.

No se utiliza contenido narrativo de los EPUB privados.
