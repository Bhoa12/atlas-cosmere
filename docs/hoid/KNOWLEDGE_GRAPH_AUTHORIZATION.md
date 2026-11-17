# Hoid authorized knowledge graph

## Purpose

This module introduces the first provider-independent graph boundary for Hoid. It projects source-controlled relations from the local editorial registry only when every supporting knowledge item is authorized by the reader's validated v2 cursor snapshot.

The graph is metadata-only. It returns entity IDs, entity kinds, relation predicates, approved claim IDs and edition-bound source citations. It never returns claim prose, summaries, aliases or EPUB passages.

## Trust and production source

Production callers must use `buildProductionHoidAuthorizedKnowledgeGraph()`. That function is bound to:

- `HOID_KNOWLEDGE_GRAPH_DEFINITION`, a source-controlled relation definition;
- `HOID_EDITORIAL_KNOWLEDGE`, the local production knowledge registry;
- `HOID_APPROVED_CLAIMS`, the local approved-claim registry.

All three are currently empty of production narrative knowledge/relations. The builder and its tests therefore establish the boundary, not a populated Cosmere graph.

The lower-level `buildHoidAuthorizedKnowledgeGraph()` exists for deterministic tests and controlled composition. Do not pass provider-supplied graph definitions or claims to it in production.

A string-valued reviewer ID and an SHA-256 digest are not authentication. Digests detect mutation; they do not prove authorship or reviewer identity. The trust decision for adding an approved claim or graph relation remains a separate source-controlled editorial change reviewed through the repository's normal code-review process.

## Relation contract

A relation contains:

- a stable relation ID;
- a subject entity ID;
- an allowlisted predicate;
- an object entity ID;
- an approved local claim ID.

The referenced approved claim must cite both endpoint entity IDs. All evidence IDs in that claim are mandatory. The builder rejects unknown endpoints, unknown claims, duplicate relation IDs, duplicate relation tuples, unsupported predicates and malformed objects.

The v1 node contract is intentionally strict:

- provenance must be `verified`;
- an original summary must exist;
- the first-safe-appearance chapter must equal the individually inspected evidence-source chapter;
- the evidence source must match the edition's exact reading-manifest locator;
- the chapter document must exist in the sparse SHA-256 allowlist;
- the evidence unlock must be a valid unit in the same work and cannot precede its source.

Requiring first appearance and the inspected source to be the same unit is conservative. A future schema can support separate first-appearance evidence and summary evidence, but it must represent and authorize both independently.

## Spoiler authorization

The graph accepts the authoritative v2 cursor snapshot, not a caller-supplied chapter map.

It calls `projectHoidCursorProgressSnapshot()`, which:

1. validates the complete snapshot and every cursor against its edition manifest;
2. projects an open chapter N to completed-through N-1;
3. treats chapter one as having no completed chapter;
4. accepts whole-work access only after explicit completion.

The graph then requires:

- each endpoint to be in verified, unlocked local knowledge;
- each claim evidence ID to be present in that same safe knowledge set;
- every evidence item's own `evidenceUnlock` threshold to be satisfied.

This is logical AND across all supporting evidence. If one source is missing or locked, the entire edge is omitted. The builder also omits its endpoint nodes so a withheld relation cannot leak through an isolated-node listing. It does not return IDs or counts of withheld edges.

Malformed progress, definitions, knowledge or claims fail closed.

## Provider boundary

This module has no provider interface and never invokes a selector. It does not construct provider context. Future answer composition must continue to use the strict ID-only selector runtime and retrieve only approved claim IDs that have independently passed the same cursor authorization boundary.

The graph output is not itself a narrative answer. Its relation predicates are visible only after all supporting evidence is unlocked.

## Provenance output

Every visible edge includes source citations for all of its claim evidence IDs:

- source work and chapter;
- exact edition ID;
- navigation SHA-256;
- individually verified chapter-document SHA-256;
- exact locator and unlock threshold.

No source passage, chapter title or EPUB bytes are copied into the repository.

## Current source coverage and limitations

The only individually inspected chapter-document hashes currently registered are the previously recorded chapter-one documents for:

- `twok` (El camino de los reyes);
- `edgedancer` (Danzante del Filo);
- `dawnshard` (Esquirla del amanecer).

The Cosmere navigation metadata does not, by itself, provide individually inspected chapter-body hashes. Consequently, this graph builder cannot accept Cosmere knowledge nodes yet. A TOC href or chapter count is not narrative evidence.

No new EPUB passages were accessible during this run, so no new summaries, entities or factual relations have been added. The production graph remains empty and the runtime must continue to abstain when no approved claim is available.

## Verification

`knowledgeGraph.test.ts` uses synthetic entity IDs, synthetic summaries and synthetic approved claims. It covers:

- cross-work AND authorization;
- the exclusive current-chapter boundary;
- later per-source unlock thresholds;
- explicit whole-work completion;
- withholding all endpoints when one supporting source is locked;
- rejection of uninspected chapter documents;
- rejection of non-verified provenance;
- rejection of unknown claims and endpoints not cited by the claim;
- duplicate and malformed relation definitions;
- malformed progress;
- accessor rejection without invoking getters;
- deterministic output ordering;
- absence of summaries, aliases and claim prose from graph output;
- production binding to the currently empty local registry.

The tests do not assert any Cosmere narrative fact.


## Consultas y planes de explicación

Consulta `KNOWLEDGE_GRAPH_QUERIES_AND_EXPLANATIONS.md`. El recorrido es dirigido, breadth-first, limitado por profundidad, número de rutas y presupuesto de expansiones. Los planes contienen únicamente IDs de afirmaciones, huellas de integridad y citas. La resolución revalida la misma huella de progreso v2 y recupera el texto editorial local exacto; no acepta prosa factual del proveedor.
