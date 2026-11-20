# Ejecución de pruebas de Hoid IA

El núcleo de Hoid IA mantiene sus comprobaciones de seguridad como funciones TypeScript independientes del framework. Esto permite que los contratos y las fronteras anti-spoilers sigan siendo reutilizables fuera de una herramienta de pruebas concreta.

## Ejecución reproducible

Tras instalar las dependencias del proyecto:

`npm install`

ejecuta únicamente las pruebas del núcleo:

`npm run test:hoid`

Para desarrollo continuo:

`npm run test:hoid:watch`

## Adaptador de pruebas

`invariants.runner.test.ts` descubre automáticamente las exportaciones de los módulos `*.test.ts` cuyo nombre termina en `Invariants` y las ejecuta con Vitest.

Una comprobación nueva debe seguir estas reglas:

- no depender de texto narrativo protegido;
- usar conocimiento sintético cuando pruebe autorización o spoilers;
- fallar de forma explícita si se rompe una frontera de seguridad;
- nombrar la función con el sufijo `Invariants` para que el adaptador la descubra.

El runner no modifica la política de autorización: únicamente hace ejecutables las comprobaciones que ya describen los invariantes del núcleo.

## Protocolo de selección de afirmaciones

- `selectionProtocol.test.ts` comprueba el fingerprint de solicitud, la ausencia de progreso en bruto, la versión del contrato y el rechazo de respuestas heredadas o reproducidas.
- `evidenceRuntime.test.ts` verifica que el runtime rechaza respuestas de selección ligadas a otra pregunta o snapshot.
- `cursorEvidenceRuntime.test.ts` y `answerClaimProvenance.test.ts` usan el adaptador de prueba versionado para mantener el mismo contrato de producción.

## Adaptadores y conformidad de proveedores

- `providerAdapter.ts` ofrece `createHoidClaimSelectorAdapter()`, una fábrica neutral que aplica el contrato de snapshot antes de llamar al transporte concreto.
- `providerAdapter.test.ts` comprueba claves cerradas, ausencia de progreso bruto, inmutabilidad profunda, rechazo antes del despacho, señal idéntica durante el transporte y propagación de cancelación activa.
- Los adaptadores específicos deben usar esta fábrica o reproducir exactamente sus garantías. La fábrica no autentica al proveedor ni sustituye el parser de respuesta del runtime.
- `providerAdapterConformance.testkit.ts` expone `defineHoidProviderAdapterConformanceSuite()` para reutilizar los mismos casos de forwarding, snapshots mutables, contextos con accessors, señales falsificadas, cancelación y errores de transporte en cada adaptador específico.
- La suite exige un máximo de un despacho por invocación y documenta que el núcleo no reintenta automáticamente errores de transporte ambiguos. Las llamadas repetidas explícitas deben conservar el mismo fingerprint para un snapshot idéntico.

## Deadline, cancelación y resultados tardíos

- `providerTimeout.test.ts` comprueba resolución normal, timeout, aborto del proveedor, cancelación del llamante, rechazo del adaptador y que una operación ya cancelada no llegue a iniciarse.
- La prueba de cancelación previa al despacho cubre la carrera entre el retorno de `invokeWithProviderDeadline` y la microtarea que invoca el adaptador: si el llamante aborta en ese intervalo, el adaptador no debe ejecutarse.
- Una respuesta tardía o un rechazo tardío no puede cambiar un resultado ya asentado por timeout o cancelación.
- `evidenceRuntime.test.ts` comprueba que un timeout aborta la señal del adaptador y que una selección válida resuelta después del deadline no se presenta.
- `cursorEvidenceRuntime.test.ts` comprueba que la cancelación iniciada por la interfaz atraviesa la fachada de cursores y llega al adaptador.
- Los adaptadores deben respetar `AbortSignal` cuando el transporte lo permita. Las pruebas también cubren el caso no cooperativo: aunque el trabajo externo no se detenga, su resultado tardío se ignora.

## Recomendaciones de lectura conscientes del progreso

- `recommendReadingNextSteps()` valida el snapshot mediante `validEditionBoundReadingPositions()` antes de recomendar reanudar una obra.
- `ReadingPosition.chapter` es el último capítulo completado; la recomendación propone `chapter + 1` como siguiente capítulo, solo si existe en el manifiesto verificado.
- Si solo hay una obra numérica en curso, se prioriza como `resume-current-work`; si hay varias, no se infiere cuál está activa y se exige que la interfaz proporcione `activeBookId`.
- La fachada de cursores proyecta el capítulo abierto N a progreso completado N-1; un cursor abierto en capítulo uno no se convierte en progreso numérico.
- Las colecciones y volúmenes sin segmentación verificada no reciben recomendaciones de reanudación numérica.
- `recommendations.test.ts` cubre progreso fuera de rango, capítulos ambiguos, selección activa explícita, límites y fuentes no segmentadas; `evidenceRuntime.test.ts` verifica la integración del runtime.
