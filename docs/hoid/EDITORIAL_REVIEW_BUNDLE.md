# Hoid complete editorial review bundle

## Purpose

Run 122 adds a single review-session manifest over all four staging categories: original summaries, atomic claims, entity identity dossiers and relationship claims. It closes the gap where summaries, entities and relationships had packet validators but atomic claims had no equivalent review packet, and where each category had to be tracked separately.

## Atomic-claim review packets

`editorialClaimReviewPackets.ts` creates deterministic packets from the validated atomic-claim batch. Each packet binds:

- the draft ID;
- the claim and statement SHA-256 digests;
- the subject ID and knowledge kind;
- the assertion kind and intent;
- the original editorial statement;
- exact edition-bound evidence;
- an unchecked seven-part checklist.

The checklist covers factual accuracy, atomicity, subject identity, completeness, originality, spoiler ceiling and provenance. Receipts use a closed set of issue codes; free-form notes are not accepted. A valid approval is only `approved-awaiting-source-promotion` and always returns `promotionAllowed: false`.

## Unified review session

`editorialReviewBundle.ts` first revalidates the complete knowledge manifest against the exact four staging batches. It then builds the existing summary, entity and relationship packets plus the new atomic-claim packets.

The resulting review manifest stores only:

- the complete knowledge-bundle fingerprint;
- category counts;
- packet category and draft IDs;
- exact packet IDs;
- content digests;
- a deterministic review-bundle fingerprint.

The manifest does not duplicate editorial prose, EPUB passages, XHTML bodies, extracted text or images. The build result separately exposes the original editorial packets to the review interface; it is not a provider-context API.

Every knowledge-bundle record must map to exactly one review packet. Missing, duplicate or unexpected packet references block the session.

## Receipt aggregation

`validateHoidEditorialReviewBundleReceipts()` rebuilds the review session from the exact current source batches, checks the review-bundle fingerprint, and delegates each receipt to its category-specific validator.

The aggregate result is one of:

- `complete`: every packet has exactly one valid approved receipt;
- `needs-revision`: all packets have receipts, but at least one is revision-required or rejected;
- `incomplete`: no malformed receipt was found, but one or more packets lack a receipt;
- `invalid`: a receipt is malformed, duplicated, unknown, mismatched or attached to a stale bundle.

Receipt aggregation is structural validation only. A `reviewerId` is not authentication. Reviewer independence, author exclusion, exact PR-head review, branch protection and Code Owner policy must be established by the protected source-control authority. This module never writes production and never merges a pull request.

## Progress and spoilers

The review session does not grant reader access. Each packet remains bound to its source evidence and unlock threshold. Reader-facing retrieval must still use the authoritative progress snapshot and the existing AND-evidence spoiler gate. Completing an editorial review cannot unlock a chapter for a reader.

## Validation

Run:

```sh
npx vitest run src/hoid/editorialClaimReviewPackets.test.ts src/hoid/editorialReviewBundle.test.ts src/hoid/editorialKnowledgeBundle.test.ts src/hoid/editorialReviewPackets.test.ts src/hoid/editorialEntityDrafts.test.ts src/hoid/editorialRelationshipDrafts.test.ts src/hoid/editorialClaimDrafts.test.ts src/hoid/editorialDrafts.test.ts
npx tsc --noEmit --strict --target ES2020 --module commonjs --moduleResolution node --skipLibCheck src/hoid/editorialReviewBundle.ts src/hoid/editorialClaimReviewPackets.ts src/hoid/editorialKnowledgeBundle.ts src/hoid/editorialReviewPackets.ts src/hoid/editorialEntityDrafts.ts src/hoid/editorialRelationshipDrafts.ts src/hoid/editorialClaimDrafts.ts src/hoid/editorialDrafts.ts src/hoid/knowledgeGraph.ts src/hoid/cursorEvidenceRuntime.ts src/hoid/cursorProgressLedger.ts src/hoid/readingBoundary.ts src/hoid/progressLedger.ts src/hoid/sqliteProgressStore.ts src/hoid/sha256.ts src/hoid/evidenceScope.ts src/hoid/editionProgressValidation.ts src/hoid/readingValidation.ts src/hoid/readingManifest.ts src/hoid/editionStructure.ts src/hoid/verifiedChapterLocators.ts src/hoid/verifiedChapterDocuments.ts src/hoid/bibliography.ts src/hoid/catalog.ts src/hoid/catalogValidation.ts src/hoid/readingContext.ts src/hoid/types.ts
```

## Copyright and provenance

Only original editorial summaries and assertions, bibliographic metadata, opaque locators and cryptographic digests may be committed. Review packets do not contain source passages. If a source document is unavailable, no claim of inspection or unsupported factual assertion may be added.
