# Run 251 — Recomendaciones: cancelación en la lectura durable final

## Objetivo

Cerrar la misma ventana de cancelación para respuestas y recomendaciones. Una recomendación que ya ha sido calculada no debe presentarse si el llamador cancela mientras el gateway realiza la última lectura durable del progreso.

## Correcciones de tipos

Run 250 añadió un resultado de cancelación al contrato de vigilancia. En `conversationGateway.ts` quedaron dos ramas duplicadas que devolvían `HoidConversationRecommendationResult` desde `answer()`, cuyo contrato exige `HoidConversationGatewayResult`. Se eliminan esas ramas incorrectas y se conserva una única traducción a `unavailable("cancelled")`.

## Frontera de recomendación

Después de `readCurrentProgress()` y antes de validar la identidad final del progreso o devolver elementos, `recommend()` vuelve a comprobar la señal del llamador. Si está abortada, devuelve `unavailable / cancelled` y no expone los elementos calculados.

Esta comprobación complementa —no sustituye— la cancelación cooperativa durante la llamada al runtime ni la comparación final de la revisión y huella del progreso.

## Prueba de regresión

Se añade una prueba determinista con una lectura durable final diferida:

1. La lectura inicial devuelve el snapshot vigente.
2. El runtime produce una recomendación sintética.
3. La segunda lectura durable queda pendiente.
4. El llamador cancela.
5. La lectura termina con el mismo snapshot.
6. El gateway debe devolver `unavailable / cancelled`, sin publicar recomendaciones.

## Privacidad y spoilers

La prueba usa fixtures sintéticos. No lee ni incorpora EPUBs, XHTML, texto protegido, localizadores privados ni afirmaciones narrativas. Esta corrección no cambia el progreso ni amplía permisos de lectura.

## Aislamiento

- Base: `feat/hoid-ia-core-run250`.
- Rama: `feat/hoid-ia-core-run251`.
- No se modifica Run 250 ni los PR anteriores.
- No se escribe en `main` ni se realiza ningún merge.
