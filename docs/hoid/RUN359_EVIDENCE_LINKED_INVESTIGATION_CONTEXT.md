# Run 359 — evidence-linked investigation context

## Purpose

This run adds a provider-neutral planner that connects two subjects already
investigated by the reader only when a reviewed relation exists in Hoid's
authorized knowledge graph. It is metadata planning, not narrative generation.

## Identity and privacy

- The session ledger and graph builder share one subject-fingerprint contract.
- Graph nodes expose hashed alias fingerprints, never raw aliases.
- Planner output contains hashed node identities, approved relation predicates,
  completed domain/topic metadata and chapter-level source references.
- Claim prose, claim IDs, evidence IDs, EPUB locators, document digests,
  provider payloads and raw labels are excluded.
- Hashes are pseudonymous metadata, not irreversible anonymization.

## Authorization

A link is emitted only when:
1. The graph is the in-memory branded output of the local authorized graph builder.
2. Graph and current progress revision/fingerprint match exactly.
3. Both endpoints have completed investigations in the exact same progress and book scope.
4. Each subject alias fingerprint resolves to exactly one graph node.
5. Every supporting source is inside the selected book scope.
6. The graph builder has already validated endpoints, claim attestations,
   source document digests and unlock thresholds.

No relation is inferred from co-occurrence, shared chapters, chronology,
similar names or model-generated text. Ambiguous aliases are withheld.

## Presentation boundary

The planner returns deterministic metadata only. A future trusted presenter
must resolve hashed node identities to approved display labels and formulate
any user-facing question. Session history does not prove understanding.

Cross-work sources remain unordered. A causal predicate can appear only when
the underlying relation claim has passed existing editorial review.

## Production data boundary

The production editorial knowledge registry and graph relation definition are
currently empty. Production planning therefore returns no links until original
summaries and relations are checked against accessible passages and reviewed.
Tests use synthetic entities and claims, not Cosmere facts.

No private EPUB, XHTML, full passage or copyrighted source text is read,
copied or uploaded by this change.
