# Protected source-control review authority

## Why a second gate exists

The entity and relationship receipt validators prove that a receipt is structurally consistent with a review packet and its SHA-256 digests. They do not authenticate the person named in `reviewerId`. A digest is an integrity check, not a signature.

Likewise, `buildHoidEditorialPromotionPlan()` is a non-writing consistency planner. A result of `ready-for-maintainer-commit` must not be interpreted as proof that a real pull request has passed repository protection.

Run 118 adds a separate source-control authority boundary. It does not replace editorial review; it verifies that the exact source-control change carrying a promotion manifest has the required protected reviews.

## Contracts

`HoidSourceControlReviewPort` is the only external dependency. The Hoid core does not import a GitHub SDK, make network requests, or depend on a particular source-control vendor.

A production adapter must:

1. Fetch the pull request from the configured repository.
2. Verify the exact base ref, head ref, head commit SHA, open state and non-draft state.
3. Fetch effective reviews and normalize them to one latest review per reviewer.
4. Exclude dismissed reviews and reviews that do not apply to the current head commit.
5. Fetch branch protection/ruleset settings for the target branch.
6. Resolve Code Owner status when that policy is required.
7. Read the promotion manifest from the exact `expectedHeadSha` and verify that it describes the same canonical promotion-plan fingerprint.
8. Return a metadata-only snapshot. Do not return review comments or free-text bodies.

The adapter must use read-only source-control permissions. It must not merge the pull request or write repository content.

## Core validation

`verifyHoidProtectedReviewSnapshot()` revalidates the returned object as untrusted input. It rejects accessors, extra properties, sparse arrays, duplicate review IDs, duplicate reviewer IDs, malformed timestamps, mismatched refs, stale head SHAs and a promotion-manifest fingerprint that differs from the local plan.

An approval counts only when all of the following hold:

- the effective review state is `APPROVED`;
- the review is not dismissed;
- its commit SHA equals the expected PR head SHA;
- the reviewer is not the PR author;
- the reviewer is unique in the adapter's normalized snapshot.

The required quorum is the greater of the request's minimum and the repository's required approving-review count. Code Owner approval, dismissal of stale approvals and administrator enforcement can be required independently.

## Promotion-plan binding

The core computes a deterministic SHA-256 fingerprint over the sorted entity IDs, sorted relationship IDs, progress revision and progress fingerprint. The adapter must read the manifest at `promotionManifestPath` from `expectedHeadSha`, parse its canonical plan fields and return the same fingerprint.

This prevents an approval for a different PR head or a different promotion bundle from being reused.

The fingerprint is not a digital signature. Trust in the snapshot comes from the configured source-control adapter fetching authoritative repository state over authenticated APIs. The core still validates the snapshot's structure and bindings.

## Result semantics

`authorizeHoidPromotionCommit()` returns `ready-for-maintainer-commit` only when the plan is internally canonical and the source-control snapshot satisfies the requested policy.

Even then it always returns:

- `protectedReviewVerified: true`;
- `promotionAllowed: false`;
- `productionWritePerformed: false`.

It never edits `editorialRegistry.ts`, `entityAliasRegistry.ts`, the production graph or any other production registry. It never merges a PR. A separate maintainer-controlled source change and the repository's own protected-branch enforcement remain mandatory.

## Failure behavior

The gate fails closed for invalid plans, malformed requests, invalid adapters, adapter errors, timeout, stale review commits, insufficient approvals, unverified branch protection and mismatched manifests.

The adapter call has an eight-second timeout. A timed-out operation may continue inside the adapter, but its result is ignored and cannot authorize a commit.

## Tests

The test suite covers exact-head binding, plan-manifest binding, author exclusion, stale/dismissed approvals, reviewer uniqueness, branch protection, Code Owner approval, draft/closed PRs, hostile accessors, adapter failure and timeout.

Test adapters are synthetic fixtures only. They are not production approvals.


## Live progress freshness

The authority gate also requires a separate `HoidPromotionProgressPort` backed by the authoritative Atlas cursor coordinator. It reads the current snapshot before the source-control call and again after review verification. Both snapshots must project to the exact revision and fingerprint stored in the promotion plan.

If the reader moves, rewinds, reopens a completed work or corrects progress while the review adapter is running, the gate returns `progress-changed` and no maintainer-commit authorization is produced. Invalid or unavailable progress and either adapter timeout also fail closed.

The source-control snapshot names the exact manifest path and its plan fingerprint. Review timestamps later than the adapter's verification time are rejected. The progress port is read-only and must not use a React component cache or a stale UI projection.


## Canonical manifest helpers

`buildHoidEditorialPromotionManifest()` serializes the canonical plan fields into a metadata-only manifest with a deterministic fingerprint. `validateHoidEditorialPromotionManifest()` rejects unknown keys, malformed plans and fingerprint mismatches. A source-control adapter should fetch the manifest bytes from the exact PR head, parse them, run this validator and place the resulting fingerprint and exact path in its snapshot.


## Vinculación de ambos extremos del Pull Request (schema v2)

Run 157 eleva el contrato del snapshot protegido a schema v2. El request debe aportar `expectedBaseSha` y `expectedHeadSha`; el snapshot debe devolver `baseSha` y `headSha`. El adaptador GitHub obtiene ambos del objeto `base.sha` y `head.sha` del Pull Request. El núcleo rechaza snapshots antiguos, SHA ausentes o discrepancias con `base-mismatch`/`head-mismatch`. Los mensajes Ed25519 de los paquetes incluyen el SHA base esperado y cambian de dominio a v2. Una revisión o firma de schema v1 no se reutiliza.
