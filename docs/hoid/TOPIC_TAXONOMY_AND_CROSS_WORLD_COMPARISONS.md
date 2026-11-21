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

The low-level `compareHoidTopicsAcrossWorlds()` helper remains a deterministic
editorial/test utility. It accepts pre-rendered answers and a supplied progress
snapshot, so it must not be called by a UI or treated as a production
authorization boundary.

Production presentation uses
`createHoidTrustedTopicComparisonPresenter()` from
`src/hoid/trustedTopicComparison.ts`. Its request accepts only topic,
dimension and subject IDs. It derives world labels and claim IDs from the
activated assignment registry, reads progress through the host-owned durable
port, and loads claims through the local approved-claim renderer.

Every distinct claim is passed through the shared trusted Ed25519 answer
presenter. The comparison boundary then binds the exact claim digest, evidence
ID set and citations back to the validated assignment and verified evidence
registry. It refreshes both the cursor snapshot and assignment activation
receipt before returning a result; any change withholds the whole comparison.

Entity comparisons additionally require each entity's own first-safe-appearance
boundary. At least two distinct reviewed world IDs are required. The output is
side-by-side only (`inference: none`): it does not infer similarity,
equivalence, causality, chronology, hierarchy, influence or a relationship
between worlds. Such conclusions require separate reviewed claims and
evidence.

The former production convenience helper now abstains unconditionally. This
prevents a future non-empty assignment registry from accidentally activating
the unsigned low-level utility as a presentation bypass. The trusted
comparison presenter remains inactive while the production assignment registry
and activation receipt are empty.

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
- strict TypeScript checks for the new services and their source/progress dependencies;\n- the dedicated `hoid-trusted-topic-comparison.yml` workflow.

Synthetic test fixtures are not production knowledge and are never inserted into the approved registry.
