# Run 172 — Separación entre primera aparición y desbloqueo de evidencia

## Hallazgo

La ruta de compatibilidad `HoidService` construía el contexto del proveedor mediante `HoidKnowledgeCatalog.entriesForContext()`. Antes de este cambio, ese método reutilizaba `isUnlocked()`, que compara el progreso con `firstSafeAppearance`.

Ese umbral solo es válido para mencionar el nombre de una entidad. No es necesariamente el umbral correcto para divulgar un resumen completo. Si una entidad aparece por primera vez en el capítulo 1 pero su resumen contiene detalles respaldados por el capítulo 4, la implementación anterior podía enviar el resumen al proveedor demasiado pronto.

Además, el contexto atribuía la fuente a `firstSafeAppearance` en vez de al capítulo real de `evidenceSource`.

## Corrección

- Se introduce `isEntityMentionUnlocked()` para expresar el límite de mención.
- `isUnlocked()` se conserva como alias de compatibilidad y queda documentado como obsoleto.
- `lockedMatches()` y `authorizeHoidContext()` usan explícitamente el límite de primera aparición.
- `entriesForContext()` exige `provenance=verified`, resumen no vacío y `isEvidenceUnlocked()`.
- `isEvidenceUnlocked()` valida el localizador de fuente contra el manifiesto exacto y exige alcanzar `evidenceUnlock`.
- `buildAuthorizedKnowledgeContext()` cita el capítulo real de `evidenceSource`, nunca la primera aparición.

## Pruebas

Las pruebas usan datos sintéticos y el manifiesto verificado de El Camino de los Reyes; no contienen hechos narrativos ni texto de los EPUBs.

Cubren:
- nombre permitido antes que el resumen;
- resumen bloqueado hasta el watermark explícito;
- ausencia de desbloqueo por progreso de otro libro;
- rechazo de progreso duplicado;
- rechazo de procedencia incompleta;
- cita del capítulo de evidencia;
- integración con la frontera heredada de `HoidService`.

## Seguridad y alcance

No se cambia el runtime estricto de claims, el progreso persistido, el catálogo bibliográfico ni los registros editoriales. No se inspeccionan EPUBs ni se incorporan resúmenes. No se escriben afirmaciones en producción. El cambio solo corrige la frontera de contexto de la ruta de compatibilidad y aclara sus contratos.

La aplicación principal continúa usando el runtime estricto de cursor/evidencia; esta reparación evita que integraciones heredadas expongan resúmenes antes de su propio límite editorial.
