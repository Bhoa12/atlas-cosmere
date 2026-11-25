# Run 309 — ámbito exacto de capítulos para seguimientos v3

## Objetivo

Conservar el contexto de libro y capítulo de una respuesta anterior cuando el lector formula un seguimiento, sin permitir que la recuperación se amplíe silenciosamente a capítulos que no formaban parte de ese contexto.

Esta ampliación conecta el contrato de referencias de capítulo por edición con el runtime de evidencias por unidad exacta v3. No cambia el ledger, no modifica el progreso y no introduce conocimiento narrativo nuevo.

## Contrato de solicitud

`HoidExactUnitEvidenceRuntime.answer()` acepta ahora el campo local opcional:

- `bookScope`: ámbito de obras declarado para la pregunta;
- `chapterScope`: referencias exactas de capítulos que limitan la recuperación del seguimiento.

`chapterScope` solo es válido si también existe `bookScope`. Se canonicaliza mediante `canonicalizeHoidChapterEvidenceScope()`, que vuelve a validar cada referencia contra el manifiesto de la edición, rechaza etiquetas ambiguas y exige al menos un ancla exacta para cada obra del ámbito.

Las referencias se comparan por identidad completa: obra, unit ID, ordinal, número visible e identity fingerprint. La coincidencia de un número de capítulo por sí sola nunca es suficiente.

## Restricción de recuperación

Cuando se proporciona `chapterScope`, una afirmación candidata solo puede entrar en el conjunto autorizado si **todas** las fuentes de evidencia de esa afirmación están dentro del ámbito exacto de capítulos citado por la respuesta anterior.

Las referencias `firstSafeAppearance` y `unlock` no se reinterpretan como capítulos citados. Siguen siendo requisitos de autorización independientes y se validan contra el snapshot v3 vivo mediante `authorizeHoidExactUnitEvidence()`.

Si no queda ninguna afirmación candidata, el runtime devuelve `no-authorized-claims`. No elimina el ámbito ni amplía la búsqueda a capítulos adyacentes.

## Frontera del proveedor

`chapterScope` es metadato local de recuperación. No forma parte de `HoidExactClaimSelectionRequest` ni de su contexto serializable.

El selector recibe únicamente:
- pregunta e intención;
- candidatos locales ya filtrados;
- IDs de afirmaciones y evidencias;
- presupuesto de selección;
- contexto conversacional acotado que ya admite el protocolo.

No recibe referencias de capítulo, unit IDs, ordinales, fingerprints ni localizadores EPUB. El filtro local se ejecuta antes de invocar al selector.

## Orden de seguridad

1. Canonicalizar la pregunta, el ámbito de obras y las referencias exactas de capítulo.
2. Leer y validar el snapshot durable v3.
3. Aplicar la restricción de capítulo a las fuentes de cada afirmación.
4. Autorizar por separado source, first-safe-appearance y unlock.
5. Releer el progreso antes de invocar al selector.
6. Volver a comprobar progreso y autorización después de la selección.
7. Mantener la verificación de recibo inmediatamente antes de presentar.

El ámbito de capítulo no es un cursor, una prueba de lectura completada ni una concesión de acceso. Solo limita dónde puede buscarse el contexto del seguimiento.

## Pruebas

Se añaden siete regresiones:
- seguimiento válido limitado al capítulo citado;
- ausencia de ampliación cuando no coincide ninguna fuente;
- rechazo de fingerprints obsoletos;
- rechazo de capítulos ajenos al ámbito de obras;
- anclas obligatorias para todas las obras de una comparación;
- independencia del umbral de desbloqueo;
- rechazo de arrays dispersos.

También se conserva la prueba que fija el fingerprint v2 original cuando no se suministra contexto conversacional, para evitar una ruptura innecesaria del protocolo existente.

## Privacidad y fuentes

La implementación usa únicamente metadatos de identidad de capítulo ya registrados. No abre EPUBs, no extrae XHTML, no copia pasajes ni añade resúmenes. El catálogo privado sigue siendo una lista de obras, no una afirmación de que sus cuerpos estén disponibles o inspeccionados.

## Límites

- El llamador debe obtener las referencias de capítulo de una respuesta previa confiable; una referencia aportada manualmente se vuelve a validar, pero no demuestra por sí misma que se haya presentado una respuesta anterior.
- La integración automática del sidecar conversacional exact-unit con el host de pantalla queda separada para una iteración posterior.
- El registro editorial exact-unit de producción continúa sujeto a la verificación de firmas, frescura y checkpoint del host confiable.
- No se habilita migración de historial ni se modifica HoidScreen.
