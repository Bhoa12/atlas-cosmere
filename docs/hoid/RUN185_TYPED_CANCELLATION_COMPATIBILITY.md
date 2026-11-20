# Hoid IA — Run 185: compatibilidad del gateway y cancelación tipada

## Hallazgo

La validación de Run 184 sobre el HEAD `c6f1115ae532dfbdb6b1eff92a9f093bb30006d6` detectó dos workflows fallidos:

- `Hoid typed entity conversation continuity`
- `Hoid phenomenon entity kind`

Ambos ejecutaban `typedConversationGateway.test.ts`. Las cuatro expectativas fallaban porque el gateway pasaba explícitamente un segundo argumento `undefined` a `runtime.answer()` cuando la llamada no incluía opciones de invocación. El comportamiento funcional era equivalente, pero el cambio de aridad rompía los contratos observables de adaptadores y tests existentes.

## Corrección

- Se añade `invokeRuntimeAnswer()` en `conversationGateway.ts`.
- Cuando no hay opciones, conserva la llamada histórica de un solo argumento.
- Cuando hay opciones explícitas, propaga el objeto sin alterarlo; esto mantiene la transmisión de `AbortSignal`.
- Los tres caminos del runtime (seguimiento tipado, correferencia y respuesta general) utilizan el mismo helper.
- Se añade una prueba de regresión que comprueba que una continuación tipada transmite la señal de cancelación y que el contexto tipado completo permanece local.

## Seguridad

- No se modifica la validación del progreso ni la reautorización de entidades.
- El selector sigue recibiendo únicamente IDs canónicos y el presupuesto cerrado.
- La señal de cancelación sigue separada del payload narrativo.
- La cancelación no cambia cursores, manifiestos ni límites N+1.
- No se añade texto libre del proveedor ni se debilita la procedencia por afirmación.

## Fuentes y privacidad

Esta iteración es exclusivamente arquitectónica. No se han abierto EPUBs ni inspeccionado pasajes nuevos. No se han copiado ni subido EPUBs, XHTML, imágenes ni texto protegido. El catálogo y el inventario editorial permanecen sin cambios.

## Validación heredada de Run 184

El HEAD de Run 184 tiene 29 ejecuciones de workflow registradas: 27 satisfactorias y 2 fallidas. Las dos fallidas comparten la misma causa de aridad en las expectativas de `typedConversationGateway.test.ts`. Esta rama corrige el contrato de llamada en vez de debilitar las pruebas.

La validación definitiva debe ejecutarse sobre el HEAD de Run 185. No se declara aprobada hasta que terminen todos los workflows y el chequeo de tipos.

## Aislamiento

- Rama: `feat/hoid-ia-core-run185`.
- Base exacta: `feat/hoid-ia-core-run184`.
- SHA base: `c6f1115ae532dfbdb6b1eff92a9f093bb30006d6`.
- PR #77 permanece abierto, en borrador y sin modificar.
- `main` no se modifica.
- Ninguna rama anterior se actualiza.
