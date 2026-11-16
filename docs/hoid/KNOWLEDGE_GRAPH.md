# Hoid IA: multi-book narrative knowledge graph

## Purpose

`knowledgeGraph.ts` adds a provider-independent visibility boundary for a future Cosmere knowledge graph. It does not ingest EPUBs, create narrative facts, infer first appearances, or call an AI provider. It accepts only reviewed graph metadata and original summaries supplied by a future ingestion/review process.

This is a schema and filtering layer, not a populated knowledge base.

## Two independent spoiler gates

Every entity and every relationship carries its own `revealAfter` list:

- Each requirement identifies one catalogue `bookId` and a positive chapter.
- All requirements are conjunctive: the reader must have progress for every listed work and must have reached every listed chapter.
- A missing progress record never counts as completion and is never replaced by another book's chapter.
- A relationship has a separate gate from its endpoints. Knowing two entities does not imply that their relationship is safe to reveal.

This supports cross-book dependencies without imposing a universal reading order. For example, a relationship may require a threshold in Work A and a later threshold in Work B. It remains hidden until both are reached.

## Evidence authorization

Each entity and relationship must cite one or more evidence IDs. Before an item can be returned:

1. Every evidence ID must exist in the supplied evidence index.
2. Every cited source must belong to a book listed in that item's reveal gate.
3. The evidence chapter must be at or after that book's gate threshold.
4. The source must be marked accessible.
5. The reader's progress for that source book must reach the evidence chapter.

An inaccessible or future evidence item makes the graph item unavailable. A visible item referencing a nonexistent or inconsistent source causes a fail-closed abstention. Evidence summaries are used only as supporting metadata; they are not copied into graph labels or treated as provider instructions.

## Neighborhood rules

`getVisibleKnowledgeNeighborhood` returns a subject and only those directly connected entities whose own gates, relation gates, endpoints, and evidence are all authorized. It never returns the label or relation label of a hidden item.

Malformed catalogues, progress ledgers, evidence indexes, or graph structures produce structured abstentions. Unknown subjects and subjects with no authorized evidence also abstain.

## Data limits and validation

- Catalogue: 1–500 books.
- Evidence index: at most 500 entries.
- Graph: at most 2,000 entities and 5,000 relations.
- Reveal gate: 1–12 unique book requirements per item.
- Evidence references: 1–12 unique IDs per item.
- IDs are restricted to a bounded ASCII identifier format.
- Graph objects use exact-key validation; duplicate IDs, dangling endpoints, self-relations, unknown catalogue books, and malformed evidence references are rejected.

## Integration contract

The caller should:

1. Load the catalogue and progress ledger through the progress engine.
2. Retrieve candidate evidence from an approved source index.
3. Pass the reviewed graph, current multi-book progress ledger, catalogue, and candidate evidence to this module.
4. Treat every `abstain` result as a hard stop.
5. Pass only the returned neighborhood and its evidence IDs to later explanation/recommendation layers.

Do not send the entire graph to a model. The model must not decide whether a hidden node or edge is visible.

## Privacy and source policy

The supplied private EPUB bibliography remains a catalogue of works only. This change adds no book-specific characters, events, relationships, chapter counts, quotations, or summaries. No protected text is stored or uploaded. A book appearing in the catalogue does not prove that any of its passages are currently accessible.

First-reveal thresholds must be established from an accessible edition structure and reviewed original notes. If a chapter or passage cannot be verified, omit that evidence or leave the graph item unavailable; never guess a threshold.

## Checks

Run:

```sh
npx --yes tsx@4.19.2 src/hoid/knowledgeGraph.selfcheck.ts
npx --yes --package typescript@5.3.3 tsc --noEmit --strict --target ES2020 --module commonjs src/hoid/progressEngine.ts src/hoid/knowledgeGraph.ts src/hoid/knowledgeGraph.selfcheck.ts
```

The self-check covers independent entity/edge gates, cross-book thresholds, future and inaccessible evidence, missing progress, malformed graph data, duplicate IDs, unknown evidence, and catalogue validation. It does not claim that a populated Cosmere graph or EPUB ingestion pipeline exists.
