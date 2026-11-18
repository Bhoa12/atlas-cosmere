# Run 132 — reviewed topic taxonomy, cross-world comparison and safe topic recommendations

## Scope

Run 132 adds a closed, metadata-only topic vocabulary and three pure TypeScript services:

- src/hoid/topicTaxonomy.ts
- src/hoid/topicComparison.ts
- src/hoid/topicRecommendations.ts

The taxonomy defines controlled topic families and the dimensions that are meaningful within each family. It does not assert that a character, work, organization, object or magic system has any particular property.

The production registry HOID_APPROVED_TOPIC_ASSIGNMENTS is intentionally empty. No Cosmere topic assignment, world membership, comparison fact or recommendation association is added by this run.

## Reviewed topic assignments

A source-controlled assignment binds:

- a subject kind (entity or bibliography work);
- the exact subject ID;
- a reviewed world ID and display label;
- one topic and one dimension permitted by the closed taxonomy;
- one already-approved editorial claim ID;
- the SHA-256 digest of that claim's exact original text;
- the exact evidence IDs for the claim;
- review audit metadata.

Assignment validation rejects duplicate subject/topic/dimension records, inconsistent or reused world labels, unknown bibliography works, entities absent from the verified entity registry, unsupported topic/dimension pairs, malformed hashes, duplicate evidence IDs and non-canonical review timestamps.

Every assignment must point to an exact record in the approved-claim registry: the claim text SHA-256 and evidence-ID set must match. Every evidence ID must also resolve to a verified knowledge record with a canonical source edition, chapter locator, independent unlock boundary and first-safe-appearance metadata. The comparison and recommendation services compare the complete source scope, including the unlock work/chapter, rather than trusting a caller-supplied citation.

The reviewer ID and timestamp are audit metadata only. They do not authenticate a human reviewer. Promotion still requires the existing protected source-control review authority and independent maintainer-controlled source changes.

## Cross-world comparison

compareHoidTopicsAcrossWorlds() accepts two to four subjects for the same topic and dimension. Each subject must have exactly one approved assignment and one evidence-runtime answer containing exactly one claim segment.

Before inclusion, the service calls presentHoidEvidenceAnswer() with the supplied authoritative v2 progress snapshot. It then checks:

- exact claim ID and approved-claim registry membership;
- SHA-256 of the original approved claim text;
- exact evidence-ID set;
- one-to-one segment mapping;
- exact source work, source chapter, locator, unlock work and unlock chapter against the verified knowledge registry;
- an entity's first-safe-appearance boundary in the current reading context.

At least two distinct reviewed world IDs are required. The result is a side-by-side presentation only (inference: none). It does not infer similarity, equivalence, causality, chronology, hierarchy, influence or a relationship between worlds. Those conclusions require separate reviewed editorial claims and evidence.

Missing, locked, ambiguous or mismatched assignments all produce the same unavailable result so the service does not disclose which subject has an unpublished assignment.

The production entry point is bound to the empty source-controlled assignment registry and therefore abstains until reviewed records are committed.

## Topic-aware recommendations

composeHoidTopicRecommendations() requires explicit selected topic IDs. It never infers interests from reading history, conversation embeddings or provider output.

A candidate work is returned only when:

1. it belongs to the private-source bibliography;
2. it has a reviewed work topic assignment for an explicitly selected topic;
3. the assignment points to an exact approved claim and its exact text/evidence digest;
4. the work is not already started or completed in the authoritative cursor context;
5. the assignment's answer passes presentHoidEvidenceAnswer() against the current progress snapshot;
6. every supporting source scope exactly matches the verified knowledge registry and has independently crossed its own chapter unlock boundary;
7. no evidence from the unread candidate work itself is used to justify recommending that unread work.

The recommendation reason is the exact already-approved claim text with its metadata-only citations. There is no semantic-similarity ranking or inferred reading order. Ranking follows the explicit topic-selection order, then the supplied bibliography order.

If no safe reviewed association exists, the result is no-safe-reviewed-matches. The production entry point uses the empty registry and therefore currently returns no topic recommendations. The lower-level registry-injection parameters are trusted test/composition seams; application code must use the production entry points, which bind the checked-in approved claims, verified knowledge and assignment registries.

## Spoiler and intellectual-property boundaries

- Every supporting source retains its own work-local unlock threshold.
- Progress in one book cannot unlock evidence in another.
- A single locked or invalid comparison entry withholds the whole comparison.
- An unread candidate cannot be recommended using its own locked chapter evidence.
- No reading progress is changed.
- No production claim, entity, alias, relationship or topic assignment is promoted.
- No EPUB, XHTML body, extracted passage, protected text or image is stored or committed.
- The supplied private bibliography is used only as the metadata catalogue.

## Provider boundary

Both services are deterministic local TypeScript. No model provider can create topic IDs, assign a world, select an evidence scope, write comparison prose or create recommendation reasons. A future provider may help with non-factual presentation only after the existing local validation boundaries.

## Verification

The dedicated workflow runs:

- topicTaxonomy.test.ts
- topicComparison.test.ts
- topicRecommendations.test.ts
- the existing cross-book evidence and reading-aware recommendation suites;
- the existing answer-presentation and cursor-evidence suites;
- strict TypeScript checks for the new services and their source/progress dependencies.

Synthetic test fixtures are not production knowledge and are never inserted into the approved registry.
