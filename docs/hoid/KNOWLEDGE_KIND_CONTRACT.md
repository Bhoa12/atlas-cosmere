# Canonical knowledge-kind contract

## Purpose

Run 138 introduced `phenomenon` as a distinct knowledge kind. A later audit found that several independently maintained allow-lists had drifted: the production catalogue, claim validator, entity resolver and graph accepted the kind, while the original-summary validator and relationship-participant validator rejected it.

That mismatch meant a phenomenon could exist in the type system and graph model but could not consistently pass the complete editorial staging path.

## Single source of truth

`src/hoid/knowledgeKinds.ts` defines the closed vocabulary:

- `character`
- `place`
- `event`
- `phenomenon`
- `concept`
- `magic`
- `organization`
- `object`

It exports:

- `HOID_KNOWLEDGE_KINDS`: immutable canonical tuple;
- `HoidKnowledgeKind`: the union derived from that tuple;
- `isHoidKnowledgeKind(value)`: non-coercing runtime guard.

`catalog.ts` re-exports the type and runtime contract for compatibility. Validators must import the shared guard rather than create local sets.

## Aligned boundaries

The canonical guard is used by:

- catalogue entries and the strict evidence runtime;
- original summary drafts;
- entity identity drafts;
- atomic claim drafts;
- relationship participants;
- entity resolution queries and records;
- relationship gateway responses;
- knowledge graph nodes;
- typed conversation contexts.

This removes independent allow-lists that could silently diverge when a new kind is added.

## Semantics and safety

This change does not create any new knowledge or authorize any source. It only makes the existing `phenomenon` category structurally consistent.

Every editorial draft still requires:
- a known bibliography work;
- an exact edition-bound chapter locator;
- a navigation digest and individually verified chapter-document digest;
- an unlock threshold in the same work;
- original editorial prose with a matching digest;
- `pending-review` status.

Relationship evidence remains mandatory for both participants and the relation itself. Cross-work evidence remains AND-authorized. Reader progress is not modified.

Staging records remain excluded from the production registry. No synthetic record is promoted, and no provider receives source text or pending editorial drafts.

## Validation

The dedicated `hoid-knowledge-kind-contract` workflow runs the shared contract tests and regression suites across the catalogue, editorial staging, relationships, entity resolution, graph and typed conversation boundaries. It also runs strict TypeScript checks.

No EPUB, XHTML body, passage, image or extracted text is committed by this change.
