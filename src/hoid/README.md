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

## Protected editorial promotion

`buildHoidEditorialPromotionPlan()` is a pure, non-writing consistency check; its receipt validators do not authenticate reviewer identities. Do not treat a ready plan or a synthetic receipt as proof of a protected review.

For a maintainer-controlled promotion, use `authorizeHoidPromotionCommit()` from `promotionReviewAuthority.ts` with a trusted, read-only `HoidSourceControlReviewPort` adapter. The adapter must fetch the exact PR head, effective reviews, branch/ruleset protection and the promotion manifest at that commit. The core revalidates the snapshot, reviewer quorum, author exclusion, stale/dismissed reviews, Code Owner policy and plan fingerprint.

The authority gate never writes production or merges a PR. It always returns `promotionAllowed: false` and `productionWritePerformed: false`; repository protected-branch rules and a separate maintainer-controlled source change remain mandatory. See `docs/hoid/PROTECTED_SOURCE_CONTROL_REVIEW_AUTHORITY.md`.

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

## Run 115 — entity-scoped claim retrieval

- Natural-language mention preflight now permits several distinct, individually authorized aliases in one question; a shared spelling, blocked alias or truncated match set remains ambiguous/withheld.
- The gateway binds the resolved entity IDs to the same v2 progress revision and fingerprint as the request, then forwards only those IDs to the cursor evidence facade.
- HoidCursorEvidenceRuntime preserves the entity scope. HoidEvidenceRuntime validates IDs against its local knowledge catalog and filters approved claims before provider selection.
- Entity-scoped claims must explicitly list every resolved entity ID. Legacy unscoped claims are not eligible for entity-scoped questions. Every claim still requires all evidence IDs to be authorized.
- The selector receives only the already-filtered candidate set; it cannot add claims or author response text.
- Production registries remain empty. Tests use synthetic entities and claims only. See docs/hoid/ENTITY_SCOPED_CLAIM_RETRIEVAL.md.

## Run 115 — entity-scoped retrieval and first Cosmere narrative drafts

- Entity mention preflight may resolve several distinct, individually authorized aliases in one question. Shared spellings, locked aliases and truncated results remain withheld.
- The gateway binds canonical entity IDs to the request's progress revision/fingerprint. The cursor evidence facade preserves the scope; the evidence runtime validates it against the knowledge catalog and filters approved claims before provider selection.
- Entity-scoped claims must list every resolved entity ID, and each ID must also occur in the claim's evidence ID set. Legacy unscoped claims cannot answer entity-scoped questions. All evidence remains AND-authorized.
- The accessible private cosmere.epub was materialized locally and its already-registered navigation digest was rechecked. The XHTML bodies for El Imperio Final chapters 1 and 2 were individually inspected; only their SHA-256 document digests and original summaries were added to staging.
- Two new character drafts (Vin and Kelsier) are pending editorial review. They are not production knowledge and do not populate the approved entity or alias registries.
- One atomic claim draft is staged for the chapter-2 Vin material, with its own SHA-256 integrity and chapter-3 completion threshold. It remains pending review and is not available to the answer runtime.
- No EPUB bytes or source passages were committed. See docs/hoid/ENTITY_SCOPED_CLAIM_RETRIEVAL.md and docs/hoid/COSMERE_TFE_CHAPTERS_1_2_INGESTION.md.


## Run 116 — chapter-three ingestion and relationship claim staging

- Three additional chapter-three XHTML documents were inspected from the currently accessible Roshar EPUBs. Their navigation digests were rechecked and individual document SHA-256 values were added to the sparse verification allowlist.
- Three original summaries are staged for El camino de los reyes, Danzante del Filo and Esquirla del amanecer. Each uses a chapter-four unlock threshold and remains pending review.
- Schema v2 stages binary relationships with subject/object evidence-index mappings and explicit relation-evidence indices. Every participant must be covered by the evidence that supports the relation.
- Relationship drafts reuse the existing atomic-claim validator for edition-bound locators, source hashes and AND authorization. Cross-work claims remain withheld until every source threshold is met.
- Relationship review packets have a separate seven-part checklist, including entity identity. Approval only returns an awaiting-promotion outcome; it never writes to production.
- Three relationship examples are staging-only. They do not create approved entities, aliases or graph edges. Production registries remain empty.
- No EPUB bytes or source passages were committed. See docs/hoid/ROSHAR_CHAPTER_THREE_INGESTION.md and docs/hoid/EDITORIAL_RELATIONSHIP_CLAIMS.md.


## Run 117 — chapter-four ingestion and entity identity promotion gates

- Three additional chapter-four XHTML documents were inspected from the currently accessible Roshar EPUBs. The registered navigation digests were rechecked and the exact chapter-body SHA-256 values were added to the sparse verification allowlist. The verified counts are now four chapters each for El camino de los reyes, Danzante del Filo and Esquirla del amanecer; El Imperio Final remains at two.
- Three original chapter-four summaries are staged with chapter-five unlock thresholds. The complete editorial-summary staging set now contains fourteen summaries; all remain pending review.
- Twelve entity identity dossiers are staged from individually verified chapter documents. Eleven have candidate canonical labels and one deliberately remains unresolved because the source does not establish a name. These dossiers do not claim first appearance and contain no alias list.
- Entity review packets use a six-part checklist for factual accuracy, identity resolution, uniqueness, completeness, spoiler ceiling and provenance. An unresolved identity cannot receive an approved receipt.
- buildHoidEditorialPromotionPlan() joins entity and relationship reviews, checks that each relationship participant has a matching identity dossier with the same kind and exact evidence scope, and re-evaluates every unlock against the current cursor snapshot.
- The promotion planner is non-writing by contract. Even a fully eligible synthetic test bundle returns ready-for-maintainer-commit, requiresProtectedReview: true, promotionAllowed: false and productionWritePerformed: false. A real reviewer identity must be authenticated through protected GitHub review; a local receipt is not a signature.
- The current staging bundle remains blocked: the unnamed Edgedancer participant is unresolved, and no independent review receipts exist. Production knowledge, alias and graph registries remain empty.
- The current Library listing exposes the three Roshar EPUBs (with duplicate copies) but not cosmere.epub. No new Mistborn chapter was inspected in this run.
- No EPUB bytes, XHTML bodies or protected passages were committed. Only source metadata, chapter locators, SHA-256 digests and original summaries are stored. See docs/hoid/ROSHAR_CHAPTER_FOUR_INGESTION.md and docs/hoid/EDITORIAL_ENTITY_IDENTITY_AND_PROMOTION.md.


The protected promotion gate also requires a read-only `HoidPromotionProgressPort`. It checks the authoritative Atlas cursor snapshot both before and after the source-control review fetch; the revision and fingerprint must still match the plan. This closes the race where a reader changes or rewinds progress while approvals are being checked. Missing, invalid, stale or changed progress fails closed.


## Run 119 — Roshar chapter-six ingestion

- The sparse chapter-document allowlist now contains chapters one through six for `twok`, `edgedancer` and `dawnshard`, plus the two previously inspected `tfe` chapters.
- Three new original Spanish summaries are staged with chapter-seven unlock thresholds. All 20 summaries remain pending editorial review and are excluded from the production registry.
- Exact edition-bound locators and chapter-body SHA-256 values are recorded; the EPUBs and XHTML bodies are not committed.
- The current Library listing exposed the three Roshar EPUBs but not `cosmere.epub`; no new Cosmere passages were inspected.
- See `docs/hoid/ROSHAR_CHAPTER_SIX_INGESTION.md` and `docs/hoid/EDITORIAL_DRAFT_PIPELINE.md`.

## Run 120 — complete editorial knowledge bundle

`editorialKnowledgeBundle.ts` builds one deterministic, metadata-only inventory across original summaries, atomic claims, entity identity dossiers and relationship claims. Every category is revalidated against its edition-bound source locators and SHA-256 integrity before inclusion.

The bundle records typed IDs, per-record digests, exact source scopes, unlock thresholds and cross-reference blockers. It never embeds summary prose, claim statements, EPUB passages, XHTML bodies or images. Atomic claim subjects and both relationship participants must resolve to entity dossiers with matching knowledge kinds; missing identities block the bundle rather than being inferred.

The manifest can be rebuilt and checked against the exact four source batches. A valid fingerprint proves only that the inventory is unchanged. `ready-for-review` does not mean approved or promotable: every record remains pending review and the builder always returns `promotionAllowed: false` and `productionWritePerformed: false`. The production registry and protected promotion authority remain separate. See `docs/hoid/COMPLETE_EDITORIAL_KNOWLEDGE_BUNDLE.md`.

### Run 120 — chapter seven and bundle inventory

The sparse chapter-body allowlist now includes chapter seven for `twok`, `edgedancer` and `dawnshard`. Their exact XHTML bytes were inspected from the currently available private EPUB editions, hashed independently and checked against the edition-bound navigation/NCX and spine. Three original Spanish summaries are staged with chapter-eight unlock thresholds; they remain pending review.

The complete editorial bundle now inventories 23 summaries, one atomic claim, 12 identity dossiers and three relationship claims across 23 distinct edition-bound source documents. It remains blocked because the atomic claim subject `tfe.vin` has no matching identity dossier. The new bundle manifest stores only typed record IDs, integrity digests, source metadata, unlock thresholds and cross-reference blockers. It does not include summary prose or source passages, and it cannot approve or write production knowledge. See `docs/hoid/ROSHAR_CHAPTER_SEVEN_INGESTION.md` and `docs/hoid/COMPLETE_EDITORIAL_KNOWLEDGE_BUNDLE.md`.


## Run 121 — TFE identity closure and chapter-eight ingestion

- Re-materialized the current Library copy of `cosmere.epub`. Its `EPUB/nav.xhtml` digest still matches the registered merged-edition digest. The existing chapter-one and chapter-two document digests were rechecked against the current file; chapter three was newly inspected and its exact NCX href, OPF manifest item and spine entry were verified before hashing.
- The chapter-three TFE document digest is `bdbdd338d35c37d455c542384b51c4d67e7e46c1e4d2a5bf6d1535e02c4808c7`. A new original Spanish summary is staged with chapter-four completion as its unlock threshold.
- The current Library copies of Danzante del Filo and Esquirla del amanecer were inspected at chapter eight. Their exact TOC hrefs, OPF manifest entries and spine entries were checked before hashing. Two original Spanish summaries are staged with chapter-nine completion thresholds.
- Two separate identity dossiers close the `tfe.vin` atomic-claim subject reference and record Kelsier's source-backed identity. They reuse the previously verified TFE chapter-one and chapter-two documents respectively. They do not add aliases or claim first appearance; both remain pending review.
- The complete metadata-only editorial bundle now contains 26 summaries, one atomic claim, 14 entity dossiers and three relationship claims across 26 distinct source documents. Its cross-reference status is `ready-for-review`; this is not editorial approval or production authorization.
- The separate promotion planner remains blocked by the unresolved Edgedancer participant and missing independent review receipts. Production registries, aliases and graph edges remain unchanged.
- The current Library listing did not expose the El camino de los reyes EPUB, so chapter eight of `twok` was not inspected in this run. No claim is made about that passage.
- No EPUB bytes, XHTML bodies or protected passages were committed. Only metadata, exact locators, SHA-256 digests and original summaries are stored.
- See `docs/hoid/RUN121_SOURCE_INGESTION.md`, `docs/hoid/COMPLETE_EDITORIAL_KNOWLEDGE_BUNDLE.md` and `docs/hoid/EDITORIAL_ENTITY_IDENTITY_AND_PROMOTION.md`.


## Paquetes de revisión editoriales unificados

El staging editorial dispone ahora de un único inventario de revisión para resúmenes, afirmaciones atómicas, identidades y relaciones. Consulta `docs/hoid/EDITORIAL_REVIEW_BUNDLE.md`.

- `editorialClaimReviewPackets.ts` añade paquetes y recibos para afirmaciones atómicas, con controles de atomicidad e identidad del sujeto.
- `editorialReviewBundle.ts` reconstruye las cuatro categorías a partir del manifiesto de conocimiento y vincula cada paquete a una huella de sesión.
- La validación agregada distingue revisión completa, necesidad de revisión, inventario incompleto y recibos inválidos.
- El manifiesto agregado contiene identificadores y digests; no duplica prosa editorial ni texto de los EPUB.
- Los recibos son evidencia estructural, no autenticación de revisores. La independencia y los permisos siguen dependiendo de la revisión protegida del control de versiones.
- Una revisión completa continúa devolviendo `promotionAllowed: false` y `productionWritePerformed: false`. La revisión editorial no modifica el progreso del lector ni desbloquea spoilers.

## Source-aware answer presentation

`answerPresentation.ts` validates the strict evidence-runtime answer envelope before it reaches the chat UI. Authorized answers retain their exact local editorial wording and display metadata-only citations with the bibliography title and source chapter. Every citation is checked against the same cursor-native v2 progress snapshot; if any unlock threshold is not completed, the entire answer is withheld.

Blocked and abstained runtime text is never echoed by the presentation boundary. Citation IDs must exactly match the answer evidence IDs, source works must exist in the private-source bibliography, and source/unlock scopes must refer to the same work. `HoidScreen` stores citations under the same progress revision/fingerprint as the answer, so the existing history invalidation policy removes both together after a reading-progress change. See `docs/hoid/RUN126_SOURCE_AWARE_ANSWER_PRESENTATION.md`.


## Progress-bound graph explanations

`explanationGateway.ts` composes the authorized graph planner and exact-claim renderer into a progress-bound application service. Requests contain only two entity IDs, bounded path limits and the authoritative v2 snapshot. The gateway compares the request snapshot with the host's live progress before and after planning/rendering, validates the plan identity, and discards the complete result if progress changes.

Production composition must use `createProductionHoidExplanationGateway()`. It binds the source-controlled graph and `HOID_APPROVED_CLAIMS`; the lower-level injected engine factory is intended for trusted composition and tests. The production graph and claim registry remain empty until editorial records are independently reviewed and promoted, so production relationship queries currently return no path rather than inventing a connection.

Rendered explanations contain only exact approved local claim text, separated into evidence-bearing segments with edition-bound citations. No provider-authored prose is accepted. The open-chapter N to completed-through N-1 boundary applies to every graph endpoint and every supporting evidence work. See `docs/hoid/EXPLANATION_GATEWAY.md` and `docs/hoid/KNOWLEDGE_GRAPH_QUERIES_AND_EXPLANATIONS.md`.

## Run 124 — Roshar source expansion

The current Library copies were inspected for `twok` chapter 8, `edgedancer` chapter 9 and `dawnshard` chapter 9. Each chapter body is bound to the existing edition navigation digest, exact relative locator and a SHA-256 digest of the original XHTML bytes. The new original Spanish summaries remain staging-only and unlock at chapters 9, 10 and 10 respectively.

The staging inventory now contains 29 summaries and 29 individually verified chapter documents. The 47-record editorial bundle remains `ready-for-review`, not approved. The production registry is unchanged and still contains no promoted narrative claims. See `docs/hoid/ROSHAR_CHAPTER_NINE_INGESTION.md`, `docs/hoid/EDITORIAL_DRAFT_PIPELINE.md` and `docs/hoid/COMPLETE_EDITORIAL_KNOWLEDGE_BUNDLE.md`.

The Library listing exposes `cosmere.epub`, but its chapter bodies were not inspected in this iteration. Existing Cosmere TOC locators do not count as chapter-body verification.

## Natural-language relationship questions

Explicit questions about a relationship, connection or shared property between two named entities are routed to the local graph explanation gateway. The route requires exactly two exact, reviewed and currently disclosed aliases; it queries a bounded directed path and tries the reverse direction only when the first direction has no path. It never falls back to the general provider selector when a relationship is unknown, ambiguous, locked or unsupported.

Graph explanations are converted back into the existing evidence-answer contract only after claim/segment equality, source identity, edition/navigation/document hashes, exact chapter locators and current unlock thresholds are revalidated. The production entity, alias and editorial registries remain empty until source-backed claims are independently reviewed, so this route intentionally abstains rather than fabricating a relationship. See `docs/hoid/NATURAL_LANGUAGE_RELATIONSHIP_ROUTING.md`.

## Run 128 — bounded multi-entity relationship explanations

`HoidRelationshipGateway` now accepts two to four exact, reviewed and currently disclosed entity mentions. Two entities retain the existing pair path. Three or four entities are decomposed into a deterministic complete pairwise matrix (at most six pairs, each with depth four and one path). The reverse direction is attempted only after a validated no-path result.

Every pair must produce a valid explanation. A missing path, stale progress, malformed source, truncated result or conflicting duplicate claim withholds the entire group. Identical claim/evidence records are deduplicated only when their complete fingerprints match. The aggregate plan ID is a deterministic SHA-256 digest over ordered entity and pair-plan IDs.

The aggregate remains the existing `HoidRenderedExplanation` contract, so the existing relationship presentation layer rechecks every source, edition, navigation digest, chapter locator, document digest and unlock threshold. The existing conversation gateway and HoidScreen route require no provider-specific changes.

The maximum group size is four (six unordered pairs, up to twelve directed queries). Larger or ambiguous groups abstain. Production editorial, alias and approved-claim registries remain empty; synthetic tests do not add Cosmere facts or promote staging records. See `docs/hoid/MULTI_ENTITY_EXPLANATIONS.md`.

## Run 129 — claim-preserving narrative composition

narrativeComposition.ts adds deterministic presentation for already-validated editorial claims. One claim remains plain, two or three are numbered, and longer explanations are grouped into neutral blocks of at most three claims. Claim wording, order and evidence IDs are preserved; the composer adds no connective facts, interpretations or free-form prose.

HoidNarrativeLayoutPort is an optional provider-neutral selector that receives only the locale, approved-claim count, resolved-entity count and a closed layout allow-list. It never receives the question, entity names, claim text, evidence IDs, source locators or EPUB content. It can select only plain, numbered or grouped. Invalid output, provider errors and timeouts fall back to the deterministic local layout.

relationshipPresentation.ts invokes the local composer only after exact claim/segment text, evidence mappings, source hashes, edition metadata, chapter locators and progress unlocks have passed validation. The formatted answer continues through the existing source-aware presentation boundary. This is a layout port, not a configured remote language provider. See docs/hoid/NARRATIVE_COMPOSITION_AND_LANGUAGE_PORT.md.


## Run 131 — cross-book evidence and reading-aware recommendations

`crossBookEvidence.ts` derives a metadata-only work matrix from the final, progress-validated answer presentation. It re-runs `presentHoidEvidenceAnswer()` against the supplied live v2 snapshot, then groups the already-validated per-segment citations by source work and chapter. Every work retains its own source-local unlock boundary; a cursor in one book cannot authorize evidence from another. The UI shows a compact cross-book coverage summary while retaining the exact per-segment citations below each claim. Single-work answers do not receive a cross-book label.

`readingAwareRecommendations.ts` composes two safe categories from the authoritative cursor context: active works are listed first with the exact open chapter and completed-through boundary, followed by unstarted bibliography entries in catalogue order. Explicitly completed works are not suggested for resumption. This is a resume/discovery aid, not a canonical reading-order engine. It does not infer chronology, plot dependencies, thematic similarity or spoiler-safe sequencing. Those capabilities remain unavailable until independently reviewed metadata exists.

The conversation gateway validates every resume entry against the exact current chapter in the v2 snapshot and every unread entry against the bibliography and started-work set. The gateway still compares the progress revision and fingerprint before and after recommendation generation. HoidScreen clears the cross-book matrix together with all other provenance if the final progress comparison becomes stale.

No source passages are read or committed in this run. The production editorial and alias registries remain unchanged; the new cross-book matrix is presentation metadata only and cannot create or promote narrative claims.


## Run 132 — reviewed topic taxonomy and cross-world comparisons

- `topicTaxonomy.ts` defines a closed, metadata-only topic vocabulary and validates source-controlled assignments against exact claim IDs, text digests, evidence IDs, work IDs, world labels and review metadata. The production assignment registry is intentionally empty.
- `topicComparison.ts` builds side-by-side comparisons for two to four subjects only when every subject has one approved assignment for the same topic/dimension and its exact one-segment answer passes the existing source-aware presentation boundary against the current v2 progress snapshot.
- Cross-world output explicitly carries `inference: "none"`. The service does not infer equivalence, similarity, causality, chronology or a relationship between worlds. Any such conclusion requires its own reviewed editorial claim.
- `topicRecommendations.ts` requires explicit selected topic IDs. It recommends only unstarted catalogue works whose reviewed work-topic association is backed by already-unlocked evidence outside the unread candidate work. It does not infer interests, thematic similarity or reading order.
- The production topic-assignment registry remains empty, so production comparisons and topic recommendations abstain until source-backed assignments are independently reviewed and committed. Synthetic tests are not production knowledge.
- No EPUB/XHTML bodies, extracted passages or protected narrative text are committed. See `docs/hoid/TOPIC_TAXONOMY_AND_CROSS_WORLD_COMPARISONS.md`.

- Run 132 hardening: topic assignments now have to match an exact approved claim text digest and evidence-ID set; every evidence ID must resolve to a verified knowledge record with canonical source and unlock scopes. Entity subjects must already exist in the verified knowledge registry and their first-safe-appearance boundary is checked against the current reading context. The comparison and recommendation paths compare the caller-supplied citation scope to the canonical evidence registry, including the unlock work/chapter. Generic registry-injection parameters are trusted test/composition seams only; application code must use the production entry points, which bind the checked-in registries. The production topic-assignment registry remains empty.



## Run 133 — protected topic-assignment promotion

`topicAssignmentPromotionAuthority.ts` closes the source-control review gap for Run 132's topic-assignment registry without changing the existing four-category editorial bundle. It builds a metadata-only plan fingerprint over exact assignment IDs/fields, assignment reviewer IDs, approved claim digests, evidence IDs, source and unlock scopes, edition/navigation/document digests, first-safe-appearance document identity, and the v2 progress revision/fingerprint.

Topic evidence validation now requires a recognized knowledge kind and an individually verified chapter-document digest for both the evidence source and first-safe-appearance chapter. A valid TOC locator alone is not sufficient.

The topic-assignment authority rebuilds the plan from the current source-controlled assignments before source-control review, requires the fixed `docs/hoid/topic-assignment-promotion.manifest.json` at the exact PR head, validates the protected branch/ruleset and latest effective approvals, and requires every assignment reviewer ID to be among the authenticated non-author approvals for that same head. Reviewer metadata in an assignment is never treated as authentication.

The authority reads the authoritative v2 progress port before and after review. It only returns `ready-for-maintainer-commit`; `promotionAllowed` and `productionWritePerformed` remain false. The production topic-assignment registry is still empty, so its production plan remains blocked. Synthetic assignments exist only in tests. See `docs/hoid/TOPIC_ASSIGNMENT_PROMOTION_AUTHORITY.md`.


## Run 134 — spoiler-safe conversational continuity

conversationContext.ts defines an ephemeral, provider-neutral context containing only canonical entity IDs and the exact SQLite v2 progress revision/fingerprint. It never stores the previous question, aliases, names, claim prose, summaries, citations or provider output. The Hoid screen keeps this context in a component-local ref only; it is not persisted to SQLite, messages or cloud storage.

The follow-up resolver recognizes only a small allowlist of group-level relationship phrases such as “¿Y entre ellos?” and “¿Y cómo se relacionan?”. Singular pronouns and demonstratives are deliberately treated as ambiguous because the current reviewed entity catalog has no grammatical-gender/coreference contract. A missing, malformed or stale context blocks the request; it never falls through to the general answer runtime.

For a recognized group follow-up, the relationship gateway receives the prior entity IDs. resolveProductionHoidEntityIds() revalidates every ID against the current source-controlled knowledge registry, its first-safe-appearance boundary and at least one currently disclosed reviewed alias record. The graph is queried again; prior explanations and text are never replayed.

Any new non-follow-up question, progress/recommendation route, error, stale result or progress change clears the ephemeral context. A restart also clears it automatically. This is intentional: continuity is session-local and is not a second progress or memory store. See docs/hoid/SPOILER_SAFE_CONVERSATION_CONTINUITY.md.


## Run 135 — reviewed coreference and pronoun follow-ups

`coreferenceRegistry.ts` defines a metadata-only, source-reviewed mapping from a narrowly supported Spanish singular pronoun (`él` or `ella`) to one canonical entity ID. The production registry remains empty until each mapping has individually inspected chapter evidence and protected source-control review. Structural review fields are not authentication by themselves.

`coreferenceResolver.ts` accepts only exact allow-listed follow-up phrases. It validates the Run 134 ID-only relationship context, checks the exact progress revision/fingerprint, reauthorizes every entity in the context against the current production entity/alias registries, and verifies every matching pronoun evidence item against an edition-bound locator, inspected document digest and same-work unlock threshold. Every evidence item is mandatory. A matching but locked candidate blocks uniqueness; the resolver never selects a visible candidate by ignoring a hidden one.

The conversation gateway sends only the single reauthorized entity ID to the strict evidence runtime. It does not send prior context, aliases, pronoun mappings or source prose. An unresolved pronoun abstains before the runtime and relationship graph. The ordinary answer-presentation boundary still verifies every claim and source before display, and the live progress is checked again after asynchronous generation.

Plural pronouns, possessives, demonstratives and unrestricted natural-language coreference remain unsupported. The production registry is empty, so production pronoun follow-ups continue to abstain until source-backed records are reviewed. Synthetic tests do not add Cosmere facts. See `docs/hoid/REVIEWED_COREFERENCE_AND_PRONOUN_SAFETY.md`.


## Run 137 — typed entity conversation continuity

`typedConversationContext.ts` extends the session-local context with canonical `HoidKnowledgeKind` values while retaining only two to four entity IDs, their exact kinds and the SQLite v2 progress revision/fingerprint. It does not store names, aliases, prior questions, claims, summaries, citations or provider output.

The resolver accepts only exact noun-category follow-ups such as “¿Y esa organización?”, “¿Y ese objeto?” and “¿Y ese sistema de magia?”. A category must match exactly one entity in the prior context. Zero matches, multiple matches, generic category phrases and stale context abstain; no entity is selected by recency or array order.

Before a selected ID reaches the strict evidence runtime, the conversation gateway reauthorizes every context ID against the production knowledge and alias registries. IDs, kinds, order and progress identity must match exactly. The runtime receives only the single selected ID. The typed context remains component-local in HoidScreen and is cleared on progress changes, unrelated routes, failed presentation, stale responses and errors.

The production editorial and alias registries remain the only factual authority. This run adds no Cosmere claims, aliases or source records. Synthetic tests validate the contracts; no private EPUB/XHTML body or protected passage is committed. See `docs/hoid/TYPED_ENTITY_CONVERSATION_CONTINUITY.md`.


## Phenomenon entities

`phenomenon` is a distinct `HoidKnowledgeKind`, separate from `event` (a bounded occurrence) and `concept` (an abstract knowledge item). The kind is accepted consistently by editorial claim/entity staging, entity resolution, the authorized knowledge graph, relationship validation, topic evidence validation and typed conversation reauthorization.

The exact Spanish follow-up “¿Y ese fenómeno?” resolves only when the current, progress-bound context contains exactly one reauthorized phenomenon ID. Ambiguous, missing or stale references abstain. The phenomenon topic in the reviewed topic taxonomy remains a separate topic classification; an entity kind does not itself create a topic assignment.

Production registries remain unchanged until source-backed records are independently reviewed. Synthetic tests establish contract behavior only.


## Run 139 — explicit topic interests

`topicInterestContext.ts` defines an ephemeral context containing only the reader's explicitly selected topic IDs and the exact SQLite v2 progress revision/fingerprint. It stores no topic labels, question text, reading history, claim prose, citations or provider output. Selection order is preserved as the reader's priority.

`topicInterestRecommendationsGateway.ts` validates the context against both the request snapshot and the live progress port. It reads only the source-controlled approved topic assignments and, if matching assignments exist, passes approved claim IDs to a trusted local answer port. The returned answers are revalidated by `composeProductionHoidTopicRecommendations()` against approved claim text, evidence IDs, citations, source scopes and same-work unlock boundaries. No provider fallback exists.

HoidScreen now exposes the closed topic taxonomy as explicit selectable interests. Results are shown only while their progress revision and fingerprint match the live snapshot. A progress change clears recommendation text and citations; the selection itself remains temporary and is rebound to the new progress only when the reader searches again. The production assignment registry remains empty, so the current UI correctly reports that no reviewed topic matches are available. See `docs/hoid/EXPLICIT_TOPIC_INTERESTS.md`.


## Run 140 — local approved-claim recommendation rendering

`HoidEvidenceRuntime.renderApprovedClaimById()` renders one exact local claim with intent `recommend` by canonical ID. It bypasses the selector entirely and requires every evidence entry to be verified, eligible for context and unlocked in its own source work. The result carries one immutable segment and reconstructed citations.

`topicApprovedClaimAnswerPort.ts` adapts this method to the explicit-topic recommendation gateway. It accepts only dense, unique canonical claim IDs and returns only exact authorized answers. HoidScreen now wires this local port into the gateway; there is no external provider fallback. The production topic-assignment registry remains empty, so this wiring does not activate recommendations until reviewed assignments exist. See `docs/hoid/LOCAL_APPROVED_CLAIM_RENDERING.md`.


## Run 141 — cursor-native topic recommendation assurance

The explicit-topic gateway passes the authoritative SQLite v2 cursor snapshot to its local approved-claim answer port. The port validates that snapshot with projectHoidCursorProgressSnapshot() and passes only the completed-through ReadingPosition[] projection to HoidEvidenceRuntime.renderApprovedClaimById(). The currently open chapter remains locked. The original v2 snapshot is retained for final source-aware presentation and recommendation composition, so the same edition-bound cursor boundary governs the entire path.

The Run 140 integration test exposed that the adapter forwarded the v2 snapshot directly to a runtime method expecting legacy ReadingPosition[] values. Run 141 corrects the adapter and adds synthetic end-to-end coverage for exact claim rendering, final citations, cross-book AND authorization, open-chapter semantics and malformed snapshots. Production topic assignments remain empty; synthetic records are test-only. See docs/hoid/CURSOR_NATIVE_RECOMMENDATION_ASSURANCE.md.


## Run 145 — source coverage and evidence completeness

`sourceCoverage.ts` exposes an immutable metadata-only inventory that separates bibliography entries, edition progress policies, verified navigation locators, individually inspected XHTML chapter documents, pending editorial summaries and production knowledge. It is descriptive only and never authorizes narrative content. The current inventory contains 24 works, 1,106 numbered-chapter navigation locators, 66 individually inspected chapter documents and 62 pending-review summaries; production knowledge and approved claims remain empty. Ambiguous chapter numbering and unsegmented volumes/collections remain blocked. See `docs/hoid/SOURCE_COVERAGE_AUDIT.md`.


## Run 229 — verified chapter-document coverage

Run 229 revalidated the user's four available EPUB editions locally and added four edition-bound XHTML SHA-256 fingerprints: El Imperio Final chapter 10, El Camino de los Reyes chapter 18, Danzante del Filo chapter 19 and Esquirla del amanecer chapter 19. No source text or chapter titles were stored. The 66 inspected document fingerprints are distinct from the 62 original summaries, which all remain pending review. Esquirla del amanecer is complete only within its 19 numbered manifest units.
