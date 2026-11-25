# Hoid IA — Run 313: Trusted application screen host

## Objetivo

Conectar el ciclo de vida del bootstrap confiable con la pantalla de Hoid sin
fabricar dependencias nativas, claves, registros editoriales ni garantías de
persistencia que todavía no estén provisionadas.

## Cambios

- Añade `projectHoidTrustedApplicationScreen()`, una proyección pura del estado
  del bootstrap.
- Añade `HoidTrustedScreenHost`, que observa el bootstrap, inicializa una
  instancia en estado `idle`, expone un reintento explícito cuando está
  `blocked` y entrega el puerto de conversación a `HoidScreen` únicamente
  cuando el bootstrap está `ready`.
- La pantalla conserva la comprobación de marca de
  `isHoidTrustedConversationScreenPort()`; la proyección no concede autoridad.
- El host recibe una fábrica, crea un bootstrap nuevo por montaje y lo destruye
  al desmontarse. Esto coincide con el contrato actual de `HoidScreen`, que
  destruye el puerto de conversación al abandonar la pestaña. No se reutiliza
  un puerto ya dispuesto al volver a abrir Hoid.
- La pantalla recibe `trustedAnswerPort={null}`: las recomendaciones que
  requieren un presenter editorial independiente permanecen bloqueadas.

## Comportamiento fail-closed

| Estado del bootstrap | Comportamiento |
| --- | --- |
| Sin fábrica | Aviso de dependencias no provisionadas; ambos puertos de respuesta permanecen cerrados |
| `idle` / `loading` | Aviso de validación; no se entrega ningún puerto |
| `blocked` | Motivo neutral y reintento explícito; no hay fallback de proveedor |
| `ready` | Se entrega únicamente el puerto de conversación creado por el bootstrap |
| `disposed` | Estado terminal de esa instancia; un nuevo montaje debe crear otro bootstrap |

El bootstrap sigue validando el progreso durable y la composición antes de
publicar `ready`. Cada turno conserva las comprobaciones de autoridad editorial,
progreso, identidad de edición y ámbito de capítulo que ejecuta el host
narrativo.

## Integración de la aplicación

`App.tsx` utiliza ahora `HoidTrustedScreenHost`. Se pasa explícitamente
`createBootstrap={null}` porque todavía no existe un composition root nativo
que pueda proporcionar de forma verificable todos los contratos de confianza.

Esto hace visible el estado real y mantiene bloqueadas las respuestas
narrativas. No es una activación de producción ni una implementación ficticia
del transporte.

## Pruebas

- Proyección de los estados `unconfigured`, `starting`, `loading`, `blocked`,
  `ready` y `disposed`.
- Preservación del motivo de bloqueo.
- El puerto solo aparece en la proyección `ready`.
- Regresión del bootstrap y del adaptador de pantalla.
- La integración estática comprueba que la fábrica crea y dispone una sesión
  por montaje, y que App no inyecta capacidades ficticias.
- TypeScript estricto para el host y `HoidScreen`.

## Privacidad y bibliografía

No se leen ni copian cuerpos EPUB, XHTML, pasajes ni prosa protegida. El catálogo
privado del Cosmere y Roshar sigue siendo el inventario de fuentes; ninguna
afirmación narrativa nueva se incorpora ni se declara verificada en este run.

## Limitaciones pendientes

- Composition root nativo con dependencias reales.
- Raíz de confianza y claves provisionadas por plataforma.
- Registro editorial firmado y checkpoint durable anti-rollback.
- Transporte concreto inyectado detrás del contrato provider-neutral.
- Presenter confiable separado para recomendaciones.
- Pruebas E2E en Android/iOS con almacenamiento nativo real.

Hasta que esos elementos estén disponibles, la pantalla informa del bloqueo y
no intenta responder mediante proveedores alternativos.
