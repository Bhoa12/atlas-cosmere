# Hoid graph queries and explanation plans

## Purpose

knowledgeGraphQuery.ts adds bounded, provider-independent traversal over a graph that has already been built from the source-controlled editorial registries and the authoritative v2 progress snapshot.

The module has three separate stages:

1. Query the authorized directed graph.
2. Produce a text-free explanation plan containing claim IDs, integrity digests and source citations.
3. Resolve that plan to the exact local approved editorial statements after revalidating the same progress snapshot.

No provider is called by these stages.

## Query semantics

A query specifies a source entity ID, a destination entity ID, a maximum path depth and a maximum number of paths. Defaults are depth 4 and 3 paths. Hard limits are depth 6 and 10 paths. Traversal is breadth-first, directed and simple: it never infers inverse predicates and never revisits a node within one path.

A fixed expansion budget prevents pathological graph shapes from consuming unbounded work. If the budget is exceeded, the query returns query-budget-exceeded and discards partial paths. If an endpoint is absent from the authorized graph, the result is the same no-path response used for an unreachable endpoint; this avoids distinguishing a locked entity from a nonexistent one.

A result is marked truncated only after an additional authorized path is actually found beyond the configured result cap.

## Explanation plan

createHoidExplanationPlan() and createProductionHoidExplanationPlan() return a plan with:

- source and target entity IDs;
- ordered paths and relation IDs;
- approved claim IDs;
- SHA-256 digest of each exact approved claim statement;
- all edition-bound evidence citations;
- progress revision and a fingerprint of the complete validated v2 reading state.

The plan contains no claim prose, summaries, aliases, chapter titles or EPUB passages. It is not provider context.

## Rendering and stale-plan protection

renderHoidExplanationPlan() accepts only a plan object created by this module in the current runtime (WeakSet identity). It revalidates the current v2 snapshot and requires both revision and progress fingerprint to match the plan. The fingerprint covers the revision, normalized completed-through positions and started work IDs; reusing a revision number with different reading positions does not keep an old plan valid.

Each local approved claim must match the plan's exact claim ID, evidence set and statement digest. Every source citation must still be unlocked. The renderer returns the original editorial statements as separate segments, plus their citations. It does not ask a provider to write connective prose or add facts.

Production rendering is bound to HOID_APPROVED_CLAIMS. The generic renderer exists for tests and controlled composition only.

The SHA-256 digest detects substitution or mutation; it is not an author or reviewer signature. Source-controlled registry changes still require normal protected review.

## Failure policy

The module fails closed for malformed queries, invalid graph inputs, invalid progress, stale plans, changed claim text, missing evidence, locked citations and traversal-budget exhaustion. No partial explanation is returned on a failure.

The production graph and claim registry remain empty until original editorial assertions have been inspected and independently approved. Synthetic fixtures test traversal and rendering mechanics only; they assert no Cosmere narrative facts.
