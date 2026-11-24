# Run 292 — Trusted conversation gateway v3

## Objetivo

Componer el host exact-unit firmado con sesiones conversacionales multi-turno. La sesión conserva metadatos locales para seguimientos, pero el proveedor solo recibe una pista acotada basada en identificadores editoriales ya autorizados.

## Cambios

- Añade `HoidTrustedConversationGatewayV3` y sesiones aisladas por conversación.
- Amplía el selector a protocolo v3 solo cuando hay contexto; llamadas sin contexto permanecen en v2.
- Proyecta `entityIds` exclusivamente desde claims editoriales firmados seleccionados.
- El contexto enviado al selector contiene solo `priorClaimIds`, `entityIds` y `bookIds`.
- Conserva localmente referencias exactas `source`, `firstSafeAppearance`, `unlock` y posiciones de lectura por libro/capítulo.
- No transmite progreso, ordinales, unit IDs, fingerprints, localizadores ni texto anterior.
- Hereda el scope de la respuesta previa solo para seguimientos; si hay varias entidades posibles, solicita aclaración.
- Invalida el contexto y retira los mensajes de la sesión al cambiar el progreso durable.
- Cancela turnos anteriores y descarta resultados tardíos.
- El host mantiene múltiples presentaciones activas (máximo 64) con invalidación independiente por mensaje.

## Protocolo de egress

```ts
{
  schemaVersion: 1,
  priorClaimIds: string[],
  entityIds: string[],
  bookIds: string[]
}
```

No contiene texto de respuestas anteriores, estado de lectura, capítulo actual ni referencias exactas. El protocolo de selección pasa a schema v3 cuando aparece el contexto; sin contexto sigue usando schema v2.

## Memoria local

La sesión conserva IDs de claims/evidencias/entidades, obras implicadas, referencias exactas de procedencia, posiciones de lectura y el fingerprint del snapshot para invalidación. Esta memoria es volátil y no se restaura entre reinicios.

Una futura persistencia deberá cifrarla y reautorizar cada referencia al restaurar. Nunca se reutilizará una autorización antigua.

## Seguridad y límites

- El contexto solo guía la selección; no concede autorización.
- Cada claim y evidencia vuelve a pasar por el runtime y host firmados.
- Una referencia ambigua produce `needs-clarification`.
- Un cambio de progreso, registro o bundle retira los mensajes afectados.
- No se conectan todavía SQLite nativo, Keystore/Keychain, selector remoto ni HoidScreen.
- No se copian ni suben EPUB, XHTML, pasajes ni prosa protegida. Las pruebas usan fixtures sintéticos.

## Próximos pasos

- Adaptador de selector v3 para proveedor intercambiable.
- Sink de mensajes para HoidScreen.
- Persistencia nativa anti-rollback.
- Pruebas E2E Android/iOS y entre procesos.
- Restauración de contexto cifrado con reautorización completa.
