# Hoid IA — Run 184: cancelación cooperativa y aislamiento de respuestas tardías

## Objetivo

Permitir que una consulta se cancele sin modificar el progreso del lector y evitar que una respuesta de proveedor recibida después del timeout o de una cancelación llegue a la presentación.

## Cambios

- El contrato HoidClaimSelector recibe un contexto de invocación con AbortSignal, separado del payload narrativo.
- providerTimeout.ts incorpora invokeWithProviderDeadline(), que instala el deadline y el listener de cancelación antes de ejecutar el adaptador.
- El helper devuelve un resultado discriminado: completed, timeout, aborted o failed.
- Un timeout o cancelación aborta la señal del adaptador y cierra la invocación una sola vez.
- HoidEvidenceRuntime.answer() acepta opciones de llamada con señal de cancelación.
- HoidCursorEvidenceRuntime.answer() propaga esas opciones después de validar el snapshot v2 y proyectar únicamente capítulos completados.
- La cancelación del llamante produce abstención request-cancelled; timeout y fallo del proveedor permanecen como provider-unavailable.
- Los resultados tardíos quedan fuera de la ruta de selección y presentación.
- Los adaptadores de prueba propagan el contexto de invocación.

## Garantías

- El progreso se valida contra el manifiesto y los umbrales N+1 antes de invocar al proveedor.
- La señal de cancelación no contiene cursor, progreso, permisos, claims ni texto editorial.
- Cancelar una llamada no modifica el snapshot, la revisión de progreso ni el fingerprint de lectura.
- Una respuesta tardía no puede entrar en la presentación aunque el adaptador resuelva después del timeout.
- Los proveedores deben respetar AbortSignal para cancelar físicamente su transporte. Si un adaptador no coopera, Hoid puede ignorar su resultado tardío, pero no puede garantizar que el trabajo remoto se detenga.
- No se reduce el presupuesto, no se sustituyen evidencias y no se inventa una respuesta de fallback.

## Pruebas añadidas

- Resolución normal sin abortar la señal.
- Timeout que aborta la señal y descarta una resolución tardía.
- Cancelación del llamante propagada al adaptador.
- No iniciar el adaptador si la señal ya estaba cancelada.
- Contención de errores del proveedor.
- Integración del timeout en HoidEvidenceRuntime.
- Integración de la cancelación a través de HoidCursorEvidenceRuntime.

## Bibliografía y privacidad

Esta iteración es arquitectónica. No se han abierto EPUBs ni se han inspeccionado pasajes nuevos. No se han añadido EPUBs, XHTML, texto protegido, imágenes ni rutas privadas. El catálogo bibliográfico y el inventario editorial permanecen sin cambios.

## Validación

La validación CI debe ejecutarse sobre el HEAD final de esta rama. No se declarará aprobada hasta que terminen los workflows y TypeScript estricto.

## Aislamiento

- Rama: feat/hoid-ia-core-run184.
- Base: feat/hoid-ia-core-run183.
- SHA base: 2707ef5487abfd4ee964d3529837c4ca37226ee8.
- PR #76 no se modifica ni se fusiona.
- main no se modifica.
- No se actualizan ramas anteriores.


## Integración de interfaz

- HoidConversationGateway.answer() transmite las opciones de cancelación a las rutas de seguimiento tipado, coreferencia y respuesta general.
- HoidScreen crea un AbortController por respuesta, muestra el control Cancelar mientras el selector está activo y aborta la llamada cuando cambia el progreso o se desmonta la pantalla.
- Antes de confirmar el mensaje en el historial, la pantalla vuelve a comprobar la señal local. Si ya fue cancelada, elimina citas, segmentos y cualquier alcance de progreso y solo muestra el aviso neutral de cancelación.
- Las recomendaciones de catálogo y las consultas locales de progreso no muestran el control de cancelación del proveedor porque no invocan el selector narrativo.
