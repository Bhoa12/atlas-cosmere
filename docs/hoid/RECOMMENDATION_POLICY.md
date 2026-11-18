# Hoid IA: recomendaciones vinculadas al progreso v2

## Alcance

La primera recomendación conversacional muestra obras del catálogo bibliográfico que todavía no se han empezado. Es una función de descubrimiento de catálogo, no un algoritmo de orden de lectura.

El catálogo contiene 24 identidades bibliográficas: 17 entradas del grupo cosmere.epub y siete del grupo roshar-epubs. La existencia de una entrada acredita únicamente que forma parte de la bibliografía aportada; no acredita que su contenido narrativo se haya inspeccionado.

## Fuente de progreso

Las recomendaciones reciben exclusivamente un snapshot v2 validado por projectHoidCursorProgressSnapshot().

- Un cursor de capítulo 1 cuenta como obra empezada aunque todavía no autorice ningún capítulo.
- Un cursor posterior sigue contando como obra empezada.
- Una finalización explícita cuenta como obra empezada y terminada.
- Un snapshot inválido o un cursor que no coincide con el manifiesto produce abstención.

No se convierte el progreso de una obra en autorización para otra.

## Datos permitidos

Cada resultado contiene únicamente:

- sourceId;
- título exacto del catálogo;
- razón cerrada unread-source;
- revisión y huella del progreso que autorizó la lista.

El gateway vuelve a validar cada elemento contra HOID_SOURCE_BIBLIOGRAPHY. Rechaza IDs desconocidos, títulos manipulados, duplicados, obras ya empezadas, razones no admitidas y lotes superiores al límite solicitado.

## Ausencia de inferencias narrativas

Las recomendaciones no:

- infieren cronología argumental;
- afirman dependencias entre novelas;
- revelan personajes, acontecimientos, alias ni conexiones;
- utilizan resúmenes no aprobados;
- piden al proveedor que invente razones;
- presentan el orden interno del catálogo como orden recomendado.

La interfaz lo declara expresamente: las obras mostradas pertenecen al catálogo y no constituyen una ruta de lectura.

## Frescura

La lista se vincula a la revisión y huella SHA-256 del snapshot. El gateway compara el progreso antes y después de la operación. Si cambia, descarta toda la lista. La interfaz también oculta resultados cuya revisión ya no coincide con el snapshot vivo del coordinador.

## Privacidad y fuentes

La función trabaja con metadatos de bibliografía y progreso. No lee ni copia texto de EPUB, no sube fuentes privadas y no requiere un proveedor de IA. Una obra incluida en el catálogo no se presenta como narrativamente inspeccionada.

## Verificación

Las pruebas de conversationGateway.test.ts cubren progreso obsoleto, cambio durante la operación, límites, IDs desconocidos, títulos manipulados, duplicados, exclusión de obras empezadas, capacidad de recomendación ausente y abstención por progreso inválido.


## Conversational routing

Spanish recommendation requests are classified deterministically by `classifyHoidConversationIntent()` and routed to `HoidConversationGateway.recommend()`. They do not enter the narrative claim selector. The UI presents only catalogue-backed works not yet started in the v2 snapshot and states that catalogue order is not a canonical reading route. Mixed recommendation/context phrasing follows the documented recommendation-first precedence. See `CONVERSATION_INTENT_ROUTING.md`.


## Reading-aware ordering

Active works are presented first so the reader can resume an existing book without having to search for it. The current chapter is the chapter open in Atlas; the completed-through boundary is exactly one chapter earlier, or null for chapter one. This metadata is copied from the validated v2 cursor context and is not a narrative summary.

Unstarted sources follow in bibliography order. That order is explicitly not a canonical Cosmere reading route. The system has no reviewed dependency or chronology metadata sufficient to recommend a safe cross-series sequence, so it does not infer one. The UI labels the two categories separately.

The conversation gateway rejects a resume entry if its current chapter or completed-through chapter differs from the authoritative snapshot. It rejects an unread entry if that work is already started, completed, unknown, duplicated or title-mismatched. The existing before/after progress revision and fingerprint checks remain mandatory.
