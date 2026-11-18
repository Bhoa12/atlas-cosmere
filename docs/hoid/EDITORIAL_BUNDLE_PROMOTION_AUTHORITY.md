# Hoid complete editorial bundle promotion authority

## Scope

Run 123 binds the four-category editorial review bundle to the existing protected source-control authority and to a fresh read of the authoritative SQLite cursor store.

The promotion package covers summaries, atomic claims, entity identity dossiers and relationship claims. It is metadata-only: the plan contains category, draft and packet identifiers, content digests, bundle fingerprints and the reader-progress revision/fingerprint. It never embeds EPUB text, XHTML bodies, summary prose or claim statements.

## Complete-bundle plan

`buildHoidEditorialBundlePromotionPlan()` first rebuilds and validates the current review manifest against the exact knowledge manifest and four source batches. It then requires `validateHoidEditorialReviewBundleReceipts()` to return `complete`. Missing receipts, revision-required receipts, rejected receipts, unknown packet IDs, duplicate receipts and stale manifests cannot produce a plan.

The plan binds:

- the complete knowledge-bundle fingerprint;
- the complete four-category review-bundle fingerprint;
- the digest of the exact approved receipt batch;
- the sorted packet references and content digests;
- the authoritative cursor revision and fingerprint;
- a deterministic SHA-256 plan fingerprint.

A plan is only eligible for protected review. It always carries `promotionAllowed: false` and `productionWritePerformed: false`.

## Protected authorization

`authorizeHoidEditorialBundlePromotion()` validates the plan and context again. It reads the live progress port, rebuilds the plan from the current four source batches and receipts, and requires an exact plan-fingerprint match before it contacts source control.

The source-control adapter must prove all of the following for the same pull request head:

- repository, PR number, base ref, head ref and exact head SHA;
- open, non-draft PR state;
- the promotion manifest read at that exact commit;
- an exact match for the complete-bundle promotion-plan fingerprint;
- verified effective branch/ruleset protection;
- the required approval quorum;
- no approval by the PR author;
- latest effective review per reviewer, with dismissed/stale approvals excluded;
- Code Owner approval when required.

The authority also requires every reviewer ID recorded in an approved receipt to appear among the authenticated, non-author, latest approvals for that exact PR head. Receipt reviewer IDs therefore need to use the same stable identity namespace as the GitHub adapter (prefer immutable GitHub user IDs, not mutable logins). A mismatch blocks authorization.\n\nThe authority then reads progress a second time. A changed revision, changed fingerprint, invalid snapshot, timeout or unavailable source fails closed.

Even a verified result is only `ready-for-maintainer-commit`. The result explicitly keeps `promotionAllowed: false` and `productionWritePerformed: false`. The module does not merge pull requests or write production registries.

## GitHub adapter boundary

`githubSourceControlReviewAdapter.ts` provides a GitHub-specific composition adapter over an injected `HoidGitHubReviewApiPort`. The injected client is responsible for authenticating and mapping GitHub REST/GraphQL data into the adapter's strict normalized records, including effective branch protection and the reviewer IDs that actually satisfy CODEOWNERS for the changed paths.

The adapter itself:
- requests PR metadata and all reviews;
- selects only the latest review per reviewer;
- rejects duplicate review IDs and malformed timestamps;
- maps Code Owner identities without inferring them from usernames;
- reads the promotion manifest at the exact PR head SHA;
- returns an untrusted snapshot that the provider-neutral Hoid authority validates again.

No GitHub SDK, token, network client or provider-specific dependency enters the Hoid core. This repository contains the adapter contract and normalization logic, not a credentialed production GitHub client. A host application must inject an authenticated read-only client before live authorization is possible.

## SQLite progress adapter

`createHoidSqlitePromotionProgressPort()` wraps the `HoidCursorProgressStore.read()` contract. That method reloads the persisted v2 ledger and validates it on each call; it deliberately avoids relying on a potentially stale UI/coordinator cache during promotion checks.

The adapter is read-only. It cannot advance, rewind or complete a reader's progress.

## Failure policy

The following conditions block authorization:
- incomplete, rejected or revision-required editorial receipts;
- changed editorial source batches or receipt contents;
- malformed or stale plan fingerprints;
- missing GitHub methods, missing protection data or unavailable Code Owner evidence;
- a manifest read from a different commit;
- a draft/closed PR, branch mismatch or head mismatch;
- insufficient or stale approvals;
- progress changes between the two authoritative SQLite reads;
- adapter errors or timeouts.

No fallback to cached progress, inferred identity, provider-generated facts or stale approvals is allowed.

## Validation

Run:

```sh
npx vitest run src/hoid/editorialBundlePromotionAuthority.test.ts src/hoid/githubSourceControlReviewAdapter.test.ts src/hoid/sqlitePromotionProgressAdapter.test.ts src/hoid/editorialReviewBundle.test.ts src/hoid/promotionReviewAuthority.test.ts src/hoid/cursorSqliteProgressStore.test.ts
npx tsc --noEmit --strict --target ES2020 --module commonjs --moduleResolution node --skipLibCheck src/hoid/editorialBundlePromotionAuthority.ts src/hoid/githubSourceControlReviewAdapter.ts src/hoid/sqlitePromotionProgressAdapter.ts src/hoid/editorialReviewBundle.ts src/hoid/promotionReviewAuthority.ts src/hoid/cursorEvidenceRuntime.ts src/hoid/knowledgeGraph.ts src/hoid/cursorProgressLedger.ts src/hoid/readingBoundary.ts src/hoid/progressLedger.ts src/hoid/sqliteProgressStore.ts src/hoid/sha256.ts src/hoid/editorialKnowledgeBundle.ts src/hoid/editorialClaimReviewPackets.ts src/hoid/editorialReviewPackets.ts src/hoid/editorialEntityDrafts.ts src/hoid/editorialRelationshipDrafts.ts src/hoid/editorialClaimDrafts.ts src/hoid/editorialDrafts.ts src/hoid/evidenceScope.ts src/hoid/editionProgressValidation.ts src/hoid/readingValidation.ts src/hoid/readingManifest.ts src/hoid/editionStructure.ts src/hoid/verifiedChapterLocators.ts src/hoid/verifiedChapterDocuments.ts src/hoid/bibliography.ts src/hoid/catalog.ts src/hoid/catalogValidation.ts src/hoid/readingContext.ts src/hoid/types.ts
```

## Current production boundary

The existing editorial staging inventory still contains an unresolved identity. Its receipt must remain revision-required. The tests use a fully resolved synthetic subset to exercise the successful path; they do not approve or alter the real staging inventory.

The current PR #16 has no submitted human reviews. No live source-control authorization or production promotion is claimed by this run.

## Copyright and source handling

Only original editorial summaries, bibliographic metadata, opaque locators, record IDs and cryptographic digests may be committed. EPUBs, XHTML bodies, extracted passages and images remain outside the repository.
