# Run 172 — Separación entre primera aparición y desbloqueo de evidencia

## Hallazgo

La ruta de compatibilidad `HoidService` construía el contexto del proveedor mediante `HoidKnowledgeCatalog.entriesForContext()`. Antes de este cambio, ese método reutilizaba `isUnlocked()`, que compara el progreso con `firstSafeAppearance`.

Ese umbral solo es válido para mencionar el nombre de una entidad. No es necesariamente el umbral correcto para divulgar un resumen completo. Si una entidad aparece por primera vez en el capítulo 1 pero su resumen contiene detalles respaldados por el capítulo 4, la implementación anterior podía enviar el resumen al proveedor demasiado pronto.

Además, el contexto atribuía la fuente a `firstSafeAppearance` en vez de al capítulo real de `evidenceSource`.

La prueba de integración también descubrió que `snapshotProviderRequest()` copiaba la proyección de lectura con los campos `chapter` y `completed` simultáneamente. El contrato de progreso exige exactamente una de esas formas; el snapshot quedaba inválido al volver a cruzar una frontera de autorización. Ahora reconstruye la unión discriminada antes de congelarla.

## Corrección

- Se introduce `isEntityMentionUnlocked()` para expresar el límite de mención.
- `isUnlocked()` se conserva como alias de compatibilidad y queda documentado como obsoleto.
- `lockedMatches()` y `authorizeHoidContext()` usan explícitamente el límite de primera aparición.
- `entriesForContext()` exige `provenance=verified`, resumen no vacío, primera aparición segura y `isEvidenceUnlocked()`.
- `isEvidenceUnlocked()` valida el localizador de fuente contra el manifiesto exacto y exige alcanzar `evidenceUnlock`.
- `buildAuthorizedKnowledgeContext()` cita el capítulo real de `evidenceSource`, nunca la primera aparición.
- `snapshotProviderRequest()` conserva la unión exclusiva de progreso (`{bookId, chapter}` o `{bookId, completed: true}`) en lugar de serializar una proyección ambigua.

## Pruebas

Las pruebas usan datos sintéticos y el manifiesto verificado de El Camino de los Reyes; no contienen hechos narrativos ni texto de los EPUBs.

Cubren:
- nombre permitido antes que el resumen;
- resumen bloqueado hasta el watermark explícito;
- ausencia de desbloqueo por progreso de otro libro;
- rechazo de progreso duplicado;
- rechazo de procedencia incompleta;
- cita del capítulo de evidencia;
- integración con la frontera heredada de `HoidService`;
- conservación del contrato de progreso en snapshots parciales y completados;
- primera aparición posterior al watermark de evidencia: ambas condiciones deben cumplirse.

## Contrato de proveedor y snapshot

El contrato de conocimiento reutiliza el tipo canónico `HoidKnowledgeKind`, incluido `phenomenon`, para que el catálogo heredado no descarte ni convierta tipos admitidos por el runtime editorial.

El progreso que cruza la frontera del proveedor es `readonly`. El snapshot conserva la unión discriminada exclusiva: `{ bookId, chapter }` o `{ bookId, completed: true }`. Las funciones de lectura, catálogo y guardia aceptan ese contrato inmutable sin volver a interpretar ni mutar el progreso.

## Seguridad y alcance

No se cambia el runtime estricto de claims, el progreso persistido, el catálogo bibliográfico ni los registros editoriales. No se inspeccionan EPUBs ni se incorporan resúmenes. No se escriben afirmaciones en producción. El cambio solo corrige la frontera de contexto de la ruta de compatibilidad y aclara sus contratos.

La aplicación principal continúa usando el runtime estricto de cursor/evidencia; esta reparación evita que integraciones heredadas expongan resúmenes antes de su propio límite editorial.
