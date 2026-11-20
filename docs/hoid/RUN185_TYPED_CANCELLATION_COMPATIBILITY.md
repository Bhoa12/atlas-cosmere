# Hoid IA — Run 185: contrato de cancelación en seguimientos tipados

## Hallazgo

La validación de Run 184 sobre el HEAD `c6f1115ae532dfbdb6b1eff92a9f093bb30006d6` detectó dos workflows fallidos:

- `Hoid typed entity conversation continuity`
- `Hoid phenomenon entity kind`

Ambos ejecutaban `typedConversationGateway.test.ts`. Cuatro expectativas todavía comprobaban la firma anterior de un solo argumento, aunque Run 184 había ampliado deliberadamente el contrato de `runtime.answer(input, options?)`. El gateway transmitía el segundo argumento como `undefined` cuando no se suministraban opciones; el fallo era una expectativa desactualizada, no una pérdida de cancelación.

## Corrección

- Se mantienen las tres rutas del gateway pasando explícitamente el segundo argumento opcional, de forma uniforme.
- Se actualizan las cuatro expectativas de seguimiento tipado para reflejar la firma vigente.
- Se conserva una prueba adicional que verifica que un `AbortSignal` explícito atraviesa un seguimiento tipado.
- La prueba comprueba también que el contexto tipado completo permanece local y no se añade al payload del runtime.
- El mock de runtime declara argumentos opcionales para que el chequeo TypeScript pueda verificar el contrato sin casts inseguros.

## Seguridad

- No se modifica la reautorización de entidades, la validación de progreso ni el desbloqueo N+1.
- La señal sigue separada del payload narrativo.
- El selector continúa recibiendo únicamente candidatos autorizados y el contrato versionado.
- La cancelación no cambia cursores, manifiestos ni autorizaciones.
- No se añade texto libre del proveedor ni se debilita la procedencia por afirmación.

## Validación heredada de Run 184

El HEAD de Run 184 tiene 29 ejecuciones de workflow registradas: 27 satisfactorias y 2 fallidas. Las dos fallidas comparten la misma causa: expectativas antiguas en `typedConversationGateway.test.ts`.

La validación del HEAD de Run 185 debe ejecutarse de nuevo después de esta corrección. No se declara aprobada hasta que terminen los workflows y TypeScript estricto.

## Fuentes y privacidad

Esta iteración es exclusivamente arquitectónica. No se han abierto EPUBs ni inspeccionado pasajes nuevos. No se han copiado ni subido EPUBs, XHTML, imágenes ni texto protegido. El catálogo y el inventario editorial permanecen sin cambios.

## Aislamiento

- Rama: `feat/hoid-ia-core-run185`.
- Base exacta: `feat/hoid-ia-core-run184`.
- SHA base: `c6f1115ae532dfbdb6b1eff92a9f093bb30006d6`.
- PR #77 permanece abierto, en borrador y sin modificar.
- `main` no se modifica.
- Ninguna rama anterior se actualiza.
