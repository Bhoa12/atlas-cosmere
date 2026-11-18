# Run 133 — topic-assignment promotion authority

## Why this boundary exists

Run 132 introduced source-controlled topic assignments for cross-world comparisons and topic-aware recommendations. Those assignments are not narrative claims by themselves, but they determine which approved claims are grouped under a topic, dimension and world label. They therefore need an explicit protected-review gate of their own.

The existing four-category editorial bundle promotion covers summaries, atomic claims, entity identities and relationships. Run 133 does not silently extend or mutate that bundle. It adds a separate authority for the topic-assignment registry.

## Exact assignment and evidence binding

`buildHoidTopicAssignmentPromotionPlan()` first runs `validateHoidTopicAssignments()` against the approved claim and verified knowledge registries. The plan contains only metadata:

- sorted assignment IDs;
- sorted reviewer IDs recorded by the assignments;
- a digest of each exact assignment field, claim ID, claim-text digest and evidence-ID set;
- a digest of each evidence source work, chapter, locator, independent unlock boundary, edition, navigation digest and individually verified chapter-document digest;
- first-safe-appearance metadata and the corresponding inspected document identity;
- the v2 progress revision and fingerprint.

It does not embed claim prose, summaries, EPUB text, XHTML, passages or images. The plan has a deterministic SHA-256 fingerprint. An empty production assignment registry is blocked rather than treated as a successful promotion.

## Source-document verification

Topic assignment validation now requires a valid knowledge kind and an individually verified document digest for both the evidence source and its first-safe-appearance chapter. A plausible chapter number or navigation locator alone is insufficient. The evidence source and unlock scope must still resolve to real units in the same work.

## Protected review and reviewer authentication

`authorizeHoidTopicAssignmentPromotion()` rebuilds the plan from the current assignment and evidence registries before it contacts source control. It then requires the trusted adapter to fetch the fixed manifest path at the exact PR head SHA.

The adapter must return the same normalized protected-review snapshot used by the existing source-control authority. The core independently checks:

- repository, PR number, base ref, head ref and exact head SHA;
- open, non-draft PR state;
- the fixed topic-assignment manifest path and exact plan fingerprint;
- effective branch/ruleset protection;
- the approval quorum, stale-review policy, author exclusion and Code Owner rule when required;
- latest effective approvals attached to the exact head commit.

Every `review.reviewerId` in the approved topic assignments must also appear among the authenticated, non-author approvals for that exact PR head. The assignment reviewer field is audit metadata, not authentication. Use the same stable identity namespace as the source-control adapter; immutable GitHub user IDs are preferred over mutable logins.

The adapter is injected through `HoidSourceControlReviewPort`. No GitHub SDK, token, network client or provider-specific dependency enters the Hoid core.

## Manifest contract

The canonical manifest path is:

`docs/hoid/topic-assignment-promotion.manifest.json`

`buildHoidTopicAssignmentPromotionManifest()` creates a metadata-only manifest from a valid plan. The source-control adapter must read that manifest at `expectedHeadSha` and return its `planFingerprint` in the protected-review snapshot. A manifest from another commit or a different assignment fingerprint is rejected.

No production manifest is committed while `HOID_APPROVED_TOPIC_ASSIGNMENTS` is empty. A synthetic manifest in tests is not production approval.

## Progress freshness

The authority reads the authoritative v2 cursor store before and after source-control review. Both revision and fingerprint must match the plan. The progress port is read-only; it cannot advance, rewind or complete any book.

A changed cursor, invalid snapshot, timeout, unavailable adapter, missing reviewer approval, draft PR or stale review blocks authorization.

## No automatic promotion

Even a successful result is only `ready-for-maintainer-commit`. It always carries:

- `promotionAllowed: false`
- `productionWritePerformed: false`

The module does not merge PRs or write the production topic registry. A maintainer remains responsible for the protected commit.

## Current production state

`HOID_APPROVED_TOPIC_ASSIGNMENTS` remains empty. The production plan therefore returns `no-topic-assignments`, and production comparisons/recommendations continue to abstain. Tests use synthetic assignments, claims and evidence only.

The topic taxonomy remains metadata-only. No world membership, Investiture property, character affiliation, thematic association or reading dependency is inferred from the bibliography.

## Validation

Run:

```sh
npx vitest run src/hoid/topicAssignmentPromotionAuthority.test.ts src/hoid/topicTaxonomy.test.ts src/hoid/topicComparison.test.ts src/hoid/topicRecommendations.test.ts src/hoid/promotionReviewAuthority.test.ts src/hoid/githubSourceControlReviewAdapter.test.ts src/hoid/editorialBundlePromotionAuthority.test.ts
npx tsc --noEmit --strict --target ES2020 --module commonjs --moduleResolution node --skipLibCheck src/hoid/topicAssignmentPromotionAuthority.ts src/hoid/topicTaxonomy.ts src/hoid/topicComparison.ts src/hoid/topicRecommendations.ts src/hoid/promotionReviewAuthority.ts src/hoid/githubSourceControlReviewAdapter.ts src/hoid/cursorEvidenceRuntime.ts src/hoid/knowledgeGraph.ts src/hoid/cursorProgressLedger.ts src/hoid/readingBoundary.ts src/hoid/progressLedger.ts src/hoid/sha256.ts src/hoid/evidenceScope.ts src/hoid/editionProgressValidation.ts src/hoid/readingValidation.ts src/hoid/readingManifest.ts src/hoid/editionStructure.ts src/hoid/verifiedChapterLocators.ts src/hoid/verifiedChapterDocuments.ts src/hoid/bibliography.ts src/hoid/catalog.ts src/hoid/catalogValidation.ts src/hoid/readingContext.ts src/hoid/types.ts
```

## Copyright and source handling

Only metadata, original editorial claims, opaque locators and cryptographic digests may enter the repository. EPUBs, XHTML bodies, extracted passages and images remain outside Git.
