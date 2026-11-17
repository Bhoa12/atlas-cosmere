# Hoid IA

Base desacoplada de proveedores para Atlas del Cosmere.

## Principio de seguridad

Hoid debe fallar de forma segura: si no puede determinar con certeza que un dato está desbloqueado para el progreso actual, no debe entregarlo.

El flujo previsto es:

`pregunta → autorización por libro/capítulo → contexto permitido → proveedor → filtro final con evidencia`

Cada frontera es independiente. Un proveedor nunca debe recibir contexto bloqueado, y su respuesta debe volver a pasar por un filtro antes de mostrarse.

## Progreso y aislamiento entre obras

El conocimiento se etiqueta con una obra y un capítulo de desbloqueo. La recuperación compara exclusivamente el progreso de esa misma obra: avanzar en otro libro no desbloquea contenido.

La integración con Atlas debe pasar por un adaptador de progreso. La interfaz de usuario no forma parte del núcleo de Hoid y los contratos internos no deben depender de React ni de un proveedor de IA concreto.

Las posiciones inválidas, desconocidas o ambiguas se tratan como no autorizadas.

La representación canónica del progreso usa un diccionario sin prototipo. Los identificadores externos, incluidos nombres especiales de propiedades de JavaScript, nunca deben modificar la herencia del estado de autorización.

### Validación estricta de snapshots

`validReadingPositions()` acepta exclusivamente objetos planos con claves conocidas y una de estas formas: capítulo, o finalización explícita. Un registro que combine `chapter` y `completed: true` es contradictorio y rechaza el snapshot completo. Tampoco se descartan silenciosamente posiciones malformadas para continuar con un progreso parcial.

La razón es de seguridad: `completed: true` autoriza toda la obra. Nunca puede inferirse a partir de un capítulo ni coexistir con él. La misma validación se aplica antes de respuestas y recomendaciones.

Consulta `docs/hoid/READING_SNAPSHOT_SECURITY.md` y `src/hoid/readingValidation.test.ts`.

## Proveedores

Los proveedores se consumen mediante contratos. El núcleo de Hoid no debe depender de una SDK concreta ni contener claves, configuración de red o lógica específica de un modelo.

Cuando no hay proveedor configurado o falla una llamada, el servicio debe comunicarlo explícitamente y no simular una respuesta de IA.

Las llamadas al proveedor también deben tener un límite temporal explícito en la frontera del servicio. Un timeout, rechazo o configuración de plazo inválida debe degradar a la misma respuesta conservadora de proveedor no disponible; nunca se muestra una salida parcial.

## Recomendaciones

Las recomendaciones actuales son deliberadamente conservadoras y se basan únicamente en metadatos del catálogo y en el progreso conocido.

No deben:

- copiar texto de los EPUB;
- inferir hechos argumentales desde fuentes no accesibles;
- afirmar dependencias o un orden de lectura canónico sin respaldo editorial verificado;
- usar progreso de identificadores que no pertenezcan al catálogo.

## Fuentes privadas

Las fuentes privadas se representan únicamente mediante metadatos, estructura de lectura y resúmenes originales respaldados. No se incluyen EPUBs ni texto protegido.

Un elemento de conocimiento debe incorporar una posición verificable antes de añadirse. Si el pasaje o la fuente no está accesible en el entorno, no se inventan hechos ni se afirma haberlo consultado.

## Pruebas mínimas

La cobertura debe incluir como mínimo:

- aislamiento de spoilers entre libros;
- preguntas que mezclan contenido permitido y bloqueado;
- bloqueo antes de llamar al proveedor;
- filtrado de spoilers introducidos por la salida del proveedor;
- progreso inválido o desconocido;
- recomendaciones limitadas a metadatos y obras verificadas.

Cualquier cambio futuro en la arquitectura debe conservar estas garantías antes de añadir capacidades de generación o recuperación más amplias.

## Modelo de amenazas y reglas de frontera

Las defensas anti-spoiler no deben depender de una única capa. Hoid trata como riesgos independientes: una pregunta que intenta inducir revelaciones futuras, un contexto recuperado con etiquetas erróneas, un proveedor que introduce información no autorizada y una integración que entrega progreso ambiguo.

Por ello, cada frontera debe aplicar estas reglas:

- **Entrada:** una petición no amplía por sí misma el conocimiento autorizado; el progreso es la única fuente de desbloqueo.
- **Recuperación:** cada elemento debe tener obra y posición de desbloqueo verificables; sin ambas, se excluye.
- **Proveedor:** recibe solo la pregunta y el contexto ya autorizado; nunca debe recibir una biblioteca completa como atajo.
- **Salida:** las afirmaciones factuales deben estar vinculadas a identificadores de conocimiento ya autorizado. El filtro final elimina las afirmaciones con evidencia desconocida, incompleta o bloqueada; tampoco deja pasar prosa libre del proveedor como si fuese conocimiento verificado. Si no existe un vínculo de evidencia por afirmación, se descarta y no se intenta completar ese hueco.
- **Degradación:** ante errores, datos incompletos o desacuerdo entre capas, Hoid reduce información en vez de ampliar el acceso.

Estas reglas también permiten sustituir o añadir proveedores sin cambiar la política de spoilers: el contrato del proveedor es una dependencia externa, mientras que la autorización y el filtrado pertenecen al núcleo.

## Contexto y respuestas adaptadas

La adaptación al lector debe producirse sin convertir el historial de lectura en una vía para ampliar conocimiento. El progreso normalizado es la única representación que usan recuperación y proveedores contextuales.

Las explicaciones deben distinguir entre información respaldada por el contexto autorizado y recomendaciones generales basadas en metadatos. Si Hoid no dispone de evidencia suficiente para responder con seguridad, debe reconocer el límite en lugar de completar huecos con hechos inventados.

El límite de contexto se aplica después de la autorización. Reducir el contexto nunca debe cambiar una entrada bloqueada en una autorizada.

### Invariantes para cambios futuros

- validar datos externos en tiempo de ejecución, aunque TypeScript declare un contrato;
- normalizar una vez las entradas de confianza y reutilizar la representación canónica;
- comprobar la salida del proveedor, incluso cuando su entrada haya sido segura;
- mantener pruebas separadas para autorización, recuperación, proveedores y filtros;
- documentar cualquier nueva capacidad de recuperación antes de conectarla a una fuente privada.

## Strict evidence-selection runtime

New integrations should prefer `HoidEvidenceRuntime` from `evidenceRuntime.ts` for narrative responses. Its provider is an ID-only selector: it can choose among locally approved original-editorial claims, but Hoid renders the exact claim text from the local registry. It never displays free-form model prose.

Every claim must cite evidence IDs, and every cited evidence item must be retrieved from verified, accessible, chapter-authorized context. Cross-book claims require every cited work and chapter to be unlocked. If no approved claim survives, the runtime abstains.

The older `HoidService` and `HoidPipeline` remain compatibility paths with different provider contracts. Do not assume they provide the same guarantee as the strict ID-only runtime. `HoidScreen` now uses the strict ID-only runtime through `editorialRegistry.ts`, not the legacy free-text `HoidService`. The production editorial registry is intentionally empty until source passages are accessible and original claims have been reviewed. The screen therefore abstains instead of inventing content; a provider selector can be injected only after approved candidates exist.

## Chapter-bounded evidence

The strict evidence runtime distinguishes an entity's `firstSafeAppearance` from the unlock chapter of each complete editorial summary. Every strict-runtime knowledge entry must include a metadata-only `evidenceSource` (bibliography work, chapter and opaque locator) and an `evidenceUnlock` threshold. A summary is never released merely because its subject was mentioned earlier. Missing or malformed scope is rejected before provider invocation.

Authorized answers return metadata-only source citations. They identify the work, chapter and locator used without copying or exposing EPUB passages.

## Edition-aware progress

`editionStructure.ts` records metadata-only chapter counts and SHA-256 fingerprints of the EPUB navigation documents inspected for the supplied source editions. It stores no chapter titles, locators, summaries or narrative text.

`toHoidReadingPositions()` now applies those edition policies before the legacy UI progress enters the authorization pipeline. The strict runtime repeats the same checks through `validEditionBoundReadingPositions()`, so a direct caller cannot bypass the UI adapter. Unknown works, out-of-range chapters and ambiguous numeric positions are omitted at the adapter and rejected at the strict runtime boundary. The combined White Sand navigation and the multi-work Arcanum collection do not receive invented global chapter counts. Elantris and Viento y verdad are capped before their first duplicated chapter number until Atlas supplies an unambiguous unit locator.

See `docs/hoid/EDITION_STRUCTURE.md` for the inspected metadata, counts and explicit limitations.

## Versioned progress ledger

`progressLedger.ts` defines the provider-neutral `HoidProgressStore` contract and a versioned `HoidProgressLedger` service. Updates require the revision last read and use atomic compare-and-swap; stale writes return a conflict instead of overwriting another session.

The ledger rejects unknown works, malformed or duplicate positions, unsupported numeric progress for unsegmented collections, unconfirmed completion, unconfirmed regression and reopening without an explicit flag. Completion remains a reader-declared state and is not converted into an invented chapter number.

The contract does not itself provide durable storage. Atlas must inject a real adapter whose compare-and-swap operation is atomic across devices/sessions before the progress can be described as synchronized or persistent. See `docs/hoid/PROGRESS_LEDGER.md`.


### Progress ledger input boundary

`HoidProgressLedger` canonicalizes both updates and persisted snapshots before reading fields. It rejects accessors, symbols, inherited or unknown properties, sparse arrays and custom array properties; exceptions from hostile proxy traps are contained. JavaScript cannot reliably identify a transparent proxy, so callers and adapters must decode JSON into plain records before crossing this boundary. See `docs/hoid/PROGRESS_LEDGER_SECURITY.md` and `src/hoid/progressLedger.test.ts`.

## Native SQLite progress adapters

`sqliteProgressStore.ts` is the legacy v1 adapter retained as the migration source. Production Atlas now uses `cursorSqliteProgressStore.ts`, which stores edition-bound v2 cursors and atomically migrates the complete v1 snapshot with a source-payload receipt. Both adapters receive an Expo SQLite-compatible database port; the Hoid core does not import Expo.

The active v2 adapter is single-device native persistence. Expo's exclusive transaction API is not supported on web, and there is no cloud synchronization. Android/iOS restart and interruption testing remains a release gate. See `docs/hoid/SQLITE_CURSOR_PROGRESS_STORE.md` and `docs/hoid/ATLAS_PROGRESS_PERSISTENCE.md`.


## Fresh-profile progress safety

Fresh Atlas profiles must start with empty chapter and completion maps. Reading
progress is authorization data and must never inherit sample/demo values. The
app uses `createEmptyAtlasReadingProgress()`; see
`docs/hoid/INITIAL_PROGRESS_POLICY.md` and
`src/hoid/initialProgress.test.ts`. Demo fixtures must remain outside every
Hoid authorization and provider path.


## Production registry and screen route

The production screen is composed through `editorialRegistry.ts` and
`HoidEvidenceRuntime`. The registry currently contains zero approved claims,
so the screen abstains. Do not restore the legacy free-text service as a
fallback. See `docs/hoid/STRICT_RUNTIME_INTEGRATION.md`.


## Atlas cursor-native progress coordinator

`cursorProgressCoordinator.ts` serializes advancement, explicit completion, confirmed reopening and confirmed correction through the v2 cursor ledger. `expoCursorProgressCoordinator.ts` composes the native SQLite v2 store. `CosmereContext` now treats that snapshot as authoritative and projects it to null-prototype chapter/completion maps only for legacy Atlas presentation. `HoidScreen` receives the original v2 snapshot and passes it to `HoidCursorEvidenceRuntime`.

While migration, validation or storage is unavailable, Atlas reading controls and Hoid queries remain disabled. A corrupt v2 snapshot or a changed retained v1 source never falls back to permissive in-memory or legacy progress. This remains native, single-device persistence, not cloud synchronization. See `docs/hoid/ATLAS_PROGRESS_PERSISTENCE.md` and `docs/hoid/CURSOR_NATIVE_ATLAS_INTEGRATION.md`.


## Versioned reading manifests and cursors

`readingManifest.ts` introduces edition-bound cursor IDs for verified numbered chapters. A cursor carries the edition ID and navigation digest, so a cursor from another edition cannot silently authorize the same numeric position. The manifest scope is explicitly numbered-chapters-only: no prologues, interludes, epilogues or other special sections are inferred.

The ambiguous prefixes remain conservative: Elantris exposes only chapters 1–47, and Viento y verdad only 1–11. Arena blanca and Arcanum remain unavailable for partial numeric cursors until their internal structures are inspected and segmented. `readingCursorAdapter.ts` provides a parallel projection from Atlas progress.

The v2 cursor contract is now the authoritative production progress representation. The transactional SQLite adapter migrates v1, retains its exact source payload and rejects later divergence. Atlas UI chapter maps are read-only projections; Hoid authorization consumes the complete v2 snapshot. See `docs/hoid/READING_MANIFESTS.md` and `docs/hoid/CURSOR_NATIVE_ATLAS_INTEGRATION.md`.


## Cursor-native progress snapshot v2

`cursorProgressLedger.ts` defines a v2 snapshot with edition-bound cursors for partial progress and explicit reader-declared completion states. `validateHoidCursorProgressSnapshot()` validates each cursor against its current manifest, rejects duplicate work positions and preserves the distinction between partial progress and completion.

`migrateHoidProgressV1ToV2()` is a pure, non-destructive migration preparation. It first validates the complete v1 snapshot with the legacy ledger, converts every partial position to an exact manifest cursor, preserves completion, revision, timestamp and editorial order, and rejects the entire migration if any position cannot be mapped unambiguously. It never silently drops a work and never writes to SQLite.

**Production cutover completed in Run 100.** `cursorSqliteProgressStore.ts` performs the transactional v1-to-v2 migration with a marker containing the exact retained source payload. `CosmereContext` uses `HoidCursorProgressCoordinator` and `HoidScreen` passes the v2 snapshot to `HoidCursorEvidenceRuntime`. There is no permissive fallback to v1 after migration. Device-level restart/interruption testing remains a release gate. See `docs/hoid/CURSOR_PROGRESS_MIGRATION.md` and `docs/hoid/CURSOR_NATIVE_ATLAS_INTEGRATION.md`.


## Cursor-native strict evidence runtime bridge

`cursorEvidenceRuntime.ts` accepts a complete v2 progress snapshot, validates its edition-bound cursors, and only then projects it into the compatibility position contract consumed by `HoidEvidenceRuntime`. It preserves explicit completion, rejects stale manifests and malformed request envelopes before selector invocation, and provides metadata-only recommendations from the same validated snapshot.

`HoidCursorEvidenceRuntime` is now the production answer path in HoidScreen. It receives the authoritative v2 snapshot, revalidates every edition-bound cursor, then delegates to the strict evidence runtime. It does not accept a second numeric progress input. See `docs/hoid/CURSOR_EVIDENCE_RUNTIME.md` and `src/hoid/cursorEvidenceRuntime.test.ts`.


## Verified chapter-level evidence locators

`verifiedChapterLocators.ts` records relative EPUB navigation hrefs for the three unique Roshar EPUBs available in the current Library runtime. Each locator is namespaced by the edition ID and the navigation-document SHA-256. `readingManifest.ts` attaches it only to the matching numbered chapter unit.

The strict evidence boundary now requires an exact locator match for `evidenceSource`, validates both source and unlock chapters against the same edition manifest, and validates `firstSafeAppearance` against a real unit in its own work. Arbitrary locator strings and sources without an inspected TOC are rejected before provider selection.

The private `cosmere.epub` was not available in the current Library listing. Its works remain in the bibliography, but this run deliberately adds no passage-level locators for them. A chapter-count record is not a substitute for a verified source locator. No chapter titles or prose are stored. See `docs/hoid/VERIFIED_CHAPTER_LOCATORS.md`.


## Exclusive chapter reading boundary

The v2 cursor denotes the chapter currently open/in progress, not a completed chapter. The evidence facade therefore authorizes only through chapter N-1 while chapter N is open. Chapter one authorizes no chapter-scoped narrative evidence; explicit reader-declared completion is the only state that unlocks the entire work.

The projection preserves started work IDs separately so recommendations do not label a chapter-one work as unread. See `readingBoundary.ts`, `readingBoundary.test.ts`, and `docs/hoid/READING_BOUNDARY_POLICY.md`.


## Editorial draft staging

`editorialDrafts.ts` is a staging-only source ingestion boundary. The first editorial batch contains three original Spanish chapter-one summaries from the accessible Roshar omnibus, `Danzante del Filo` and `Esquirla del amanecer` EPUBs. Each is bound to its exact edition, navigation locator and chapter-document SHA-256 allowlist entry; each complete summary unlocks at chapter 2, not while chapter 1 is open. `verifiedChapterDocuments.ts` records only the three chapter files whose bytes were actually inspected.

The draft remains `pending-review`. `editorialRegistry.ts` does not import it, so the production evidence runtime still abstains. A separate editorial review must check accuracy, originality and spoiler scope before a source-controlled change promotes any item into the approved registry.

See `docs/hoid/EDITORIAL_DRAFT_PIPELINE.md` and `src/hoid/editorialDrafts.test.ts`. No EPUB, XHTML or source passage is committed.


## Editorial summary integrity and review packets

Pending original summaries are now bound to a recomputed UTF-8 SHA-256 digest. The deterministic review-packet builder includes only original editorial prose and metadata; a structurally valid approval receipt remains `approved-awaiting-source-promotion` and cannot modify the production registry. Human reviewer identity must be authenticated through protected GitHub review, not by trusting a local receipt. See `docs/hoid/EDITORIAL_REVIEW_PACKETS.md`.


## Atomic editorial claim staging

`editorialClaimDrafts.ts` models one original assertion with one or more independently verified chapter sources. Each source has its own edition-bound locator, document digest and unlock threshold. Cross-work claims use AND semantics: every source threshold must be satisfied before the claim is marked eligible for independent review.

The eligibility projection accepts the authoritative v2 cursor snapshot and internally applies the cursor-native chapter N to N-1 boundary. It returns claim IDs and unmet metadata requirements only; it never returns assertion text and is not a provider-context API. Drafts remain `pending-review` and cannot enter `editorialRegistry.ts`. SHA-256 is an integrity check, not an author or reviewer signature. See `docs/hoid/EDITORIAL_ATOMIC_CLAIMS.md`.


## Navegación verificada de cosmere.epub

Run 106 inspeccionó el OPF y `EPUB/nav.xhtml` del EPUB privado. Se incorporaron 653 localizadores relativos para capítulos numerados de 13 IDs bibliográficos, vinculados al digest de navegación de la edición. Elantris se limita a 1–47; Arena blanca y Arcanum siguen sin cursores numéricos hasta segmentar sus unidades especiales. Los localizadores no equivalen a documentos narrativos inspeccionados ni a afirmaciones aprobadas. Consulta `docs/hoid/COSMERE_EPUB_NAVIGATION_AUDIT.md`.


## Consultas al grafo y planes de explicación

`knowledgeGraphQuery.ts` consulta únicamente el grafo autorizado, con recorrido dirigido y límites de profundidad, número de rutas y expansiones. `createHoidExplanationPlan()` genera un plan sin texto narrativo; `renderHoidExplanationPlan()` solo recupera declaraciones editoriales locales cuyos IDs, evidencias y SHA-256 coinciden y cuyo snapshot v2 conserva la misma huella. La ruta de producción está vinculada a los registros locales, actualmente vacíos. No se generan hechos ni prosa factual del proveedor. Consulta `docs/hoid/KNOWLEDGE_GRAPH_QUERIES_AND_EXPLANATIONS.md`.


## Spoiler-aware entity resolution

`entityResolver.ts` resolves exact Unicode-normalized names and aliases only after validating the source-backed entity and the authoritative v2 progress snapshot. Entity first appearance and full-summary unlock are not enough to disclose every alias: `entityAliasRegistry.ts` gives each alias its own source locators, document digests and unlock thresholds. Multiple alias sources use AND semantics.

The resolver filters both locked entities and locked aliases before matching, so an unknown alias and a locked alias have the same `not-found` result. Ambiguous authorized aliases return bounded candidates rather than choosing one silently. Results contain IDs, kind, the matched authorized alias, entity and alias citations, and a progress fingerprint; they never return summaries or EPUB prose.

Matching is exact after NFKD normalization, mark/format folding, case folding and whitespace normalization. No fuzzy, substring, embedding or provider-generated matching is used. The production function `resolveProductionHoidEntities()` is bound to the source-controlled editorial and alias registries, both currently empty. See `docs/hoid/ENTITY_RESOLUTION.md`.


## Conversation progress freshness

`conversationGateway.ts` wraps the strict cursor evidence runtime and checks the canonical v2 progress fingerprint before and after each asynchronous answer. If the authoritative snapshot changes, the gateway discards the complete answer and returns only a neutral reason code. `HoidScreen` uses a ref-backed getter so the post-await check sees the latest rendered context snapshot.

This is stale-response suppression, not provider cancellation. A selector already invoked may finish with its previously authorized candidate set, but its answer and citations are never rendered after a progress change. See `docs/hoid/CONVERSATION_PROGRESS_FRESHNESS.md` and `src/hoid/conversationGateway.test.ts`.


### Conversational intent routing

`conversationIntent.ts` deterministically routes valid Spanish questions to `explain`, `context` or metadata-only `recommend`. The gateway validates the selected intent independently. Recommendation requests bypass the narrative selector and use the catalogue-only recommender; see `docs/hoid/CONVERSATION_INTENT_ROUTING.md`.


### Cursor-native conversation context

`cursorReadingContext.ts` projects the authoritative SQLite v2 snapshot into book titles, open chapter numbers and completed-through boundaries. It is metadata-only; narrative recaps still require approved editorial claims. The freshness-checked gateway exposes this as `readingContext()`. See `docs/hoid/CURSOR_READING_CONTEXT.md` and `docs/hoid/CONVERSATION_INTENT_ROUTING.md`.


## Conversation history spoiler invalidation

Run 113 binds every ready assistant answer, reading-context result and catalogue recommendation to the exact v2 progress revision and fingerprint. HoidScreen filters stale messages during render, prunes them from state after a progress change, and checks request/result/live scopes immediately before committing a response. User-authored messages and the static greeting remain. See `docs/hoid/CONVERSATION_HISTORY_SPOILER_INVALIDATION.md` and `conversationHistoryPolicy.ts`.


## Run 114 additions

- `resolveProductionHoidEntityMentions()` scans exact, Unicode-normalized whole-word aliases in natural-language questions before `HoidConversationGateway.answer()` invokes the evidence runtime.
- Known aliases without their own reviewed disclosure record, aliases whose entity or evidence is still locked, mixed safe/blocked mentions, and ambiguous matches fail closed. The UI uses the same generic no-authorized-evidence wording so it does not disclose which alias caused the block.
- The entity preflight is a safety gate only; it does not replace claim selection, source provenance or chapter-level authorization.
- Three additional original chapter-two summaries are staged for `twok`, `edgedancer` and `dawnshard`. Their XHTML digests are registered independently and their unlock threshold is chapter three. All remain pending review and are not production knowledge.
- The chapter-two ingestion record is documented in `docs/hoid/ROSHAR_CHAPTER_TWO_INGESTION.md`. No EPUB or protected passage is committed.
- `cosmere.epub` was not accessible in the Library during this run; no new Cosmere chapter bodies were inspected.
