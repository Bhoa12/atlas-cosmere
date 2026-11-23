# Run 248 — matriz de concurrencia y frescura del progreso conversacional

## Objetivo

Demostrar que el gateway descarta una respuesta completa si la proyección autoritativa de lectura cambia mientras una operación asíncrona está en curso. La cobertura se amplía a rutas conversacionales que comparten la misma garantía, pero que antes solo estaban representadas por una prueba de carrera en la ruta genérica.

## Rutas cubiertas

La nueva suite `conversationGatewayProgressRace.test.ts` comprueba cuatro escenarios:

1. **Seguimiento de entidad tipada.** Se crea un contexto efímero ligado a la revisión y fingerprint iniciales. Mientras el runtime permanece pendiente, el lector avanza de capítulo. El gateway devuelve `unavailable / progress-changed` y no expone la respuesta ni el contexto tipado.
2. **Seguimiento de grupo con ámbito explícito.** Un contexto de dos entidades se resuelve bajo un ámbito cross-work. Si cambia el progreso durante la selección, el resultado completo se descarta; la ruta abreviada del grafo local no se invoca.
3. **Resolución de correferencia.** Una referencia resuelta por evidencia revisada no permite conservar la respuesta si el progreso cambia mientras el runtime trabaja.
4. **Lectura duradera.** Cuando existe `refreshCurrentProgress`, el gateway utiliza ese puerto antes y después del trabajo asíncrono en lugar de confiar en un getter potencialmente cacheado.

Las pruebas usan snapshots sintéticos y un runtime diferido controlado por promesas. No utilizan contenido narrativo.

## Garantías comprobadas

- La petición se compara primero con el progreso autoritativo.
- El contexto tipado o la correferencia se revalidan contra la identidad de progreso esperada antes de cruzar al runtime.
- Después del trabajo asíncrono, el gateway vuelve a leer el progreso autoritativo.
- Una revisión o fingerprint distinta produce `progress-changed`.
- La respuesta, citas y contextos derivados no se incluyen en el resultado de error.
- La ruta con ámbito explícito permanece en el runtime estricto.
- La interfaz mantiene su comprobación posterior a la presentación confiable antes de confirmar texto y citas.

## Límite deliberado

Esta frontera **descarta** el resultado cuando detecta un cambio; no promete interrumpir inmediatamente un proveedor que ignore la señal de cancelación. El gateway actual realiza una comprobación posterior y falla de forma cerrada. La cancelación cooperativa del usuario continúa transmitiéndose mediante `AbortSignal`. Una futura suscripción a cambios del ledger podría ahorrar trabajo del proveedor, pero requeriría un puerto de eventos real en el coordinador de progreso y no se simula aquí.

## Validación

El workflow `.github/workflows/hoid-conversation-progress-race-matrix.yml` ejecuta la nueva matriz junto con la suite principal del gateway y comprueba TypeScript estricto para los contratos de progreso, contexto y pantalla.

## Privacidad y conocimiento

No se leen EPUBs ni XHTML. No se incorporan texto protegido, localizadores privados, resúmenes o afirmaciones nuevas. La bibliografía metadata-only existente permanece sin cambios. La matriz solo valida la frescura de snapshots de progreso sintéticos.

## Aislamiento

- Base: `feat/hoid-ia-core-run247`.
- Rama de trabajo: `feat/hoid-ia-core-run248`.
- No se escribe en `main`.
- No se retargetean, cierran ni fusionan PRs anteriores.
