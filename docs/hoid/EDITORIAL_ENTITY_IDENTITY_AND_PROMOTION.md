# Editorial entity identity and controlled promotion

## Purpose

Relationship claims need independently checked participant identities. A relationship review must not be the first place where a name, identity or alias is silently established.

Run 117 introduces a staging-only entity identity dossier and a non-writing promotion planner. Neither changes the production knowledge registry, alias registry or graph definition.

## Entity identity dossier v1

Each dossier contains:

- stable entity ID;
- knowledge kind;
- a discriminated identity state;
- one or more mandatory, edition-bound evidence records;
- separate SHA-256 digests for identity and complete draft;
- pending-review status.

A resolved identity carries a candidate canonical display label. This label is not an alias and is not available to the production resolver. The dossier deliberately has no alias array and makes no claim about first appearance. Alias spellings require their own evidence and review through the separate alias registry.

An unresolved identity carries only the closed issue code identity-not-established. It has no candidate label. An unresolved identity cannot receive an approved review receipt and blocks promotion of any relationship that references it.

## Current staging inventory

Twelve dossiers are staged from inspected chapter-three and chapter-four documents:

- Eleven candidate named identities.
- One deliberately unresolved Edgedancer participant because the inspected source does not establish a name.

All twelve remain pending review. The source document and unlock threshold are validated independently. The identity evidence chapter is not asserted to be the character's first appearance.

## Review contract

Entity review packets use six independent checks:

1. Factual accuracy.
2. Identity resolution.
3. Uniqueness.
4. Completeness.
5. Spoiler ceiling.
6. Provenance.

An approved receipt is bound to the packet ID and both identity/draft hashes. It returns approved-awaiting-source-promotion and promotionAllowed=false. The receipt validator checks shape and consistency; it does not authenticate the reviewer. Reviewer identity must be authenticated through protected GitHub review and repository permissions. A SHA-256 digest is an integrity check, not a signature.

Free-text reviewer notes are intentionally excluded. Closed note codes avoid turning the review channel into an accidental store for protected passages.

## Non-writing promotion planner

buildHoidEditorialPromotionPlan() validates the complete entity and relationship batches, their review packets and receipts, and the authoritative cursor snapshot.

It blocks promotion when any of the following holds:

- an entity identity is unresolved;
- an entity or relationship lacks an approved review receipt;
- a relationship participant has no matching entity dossier;
- the entity kind differs from the relationship participant kind;
- participant identity evidence does not match the exact relationship evidence indices;
- any evidence unlock is still ahead of the completed-through cursor;
- the progress snapshot or any receipt is invalid.

A ready result is only a deterministic plan for a maintainer-controlled source change. It returns ready-for-maintainer-commit with requiresProtectedReview=true, promotionAllowed=false and productionWritePerformed=false. The module never writes to editorialRegistry.ts, entityAliasRegistry.ts or the production graph.

## Current gate result

The real staging bundle is blocked. The unnamed Edgedancer participant remains unresolved, and no independent review receipts have been supplied. Production registries remain empty.

The test suite creates synthetic receipts only to verify that a fully consistent bundle can reach the maintainer-commit planning state. Those fixtures are not production approvals and are not committed as receipts.

## Security and copyright

Evidence validation reuses the atomic claim validator and checks exact edition, navigation, chapter locator and chapter-document digest. All evidence items are mandatory (AND semantics).

No EPUB or XHTML content is included in entity dossiers, review packets or promotion plans. Only IDs, labels for review, metadata, locators and digests are used.


## Protected source-control authorization (Run 118)

The pure promotion planner proves only internal consistency. Its synthetic test receipts are not proof of authenticated reviews. Run 118 adds a separate `HoidSourceControlReviewPort` contract and `authorizeHoidPromotionCommit()` gate.

The adapter must fetch the real pull request, effective reviews, branch/ruleset protection and the promotion manifest at the exact head commit. The core validates repository, PR, base/head refs, head SHA, manifest fingerprint, review quorum, author exclusion, stale/dismissed state and optional Code Owner requirements.

The core has no GitHub SDK or network dependency. The adapter is a trusted read-only boundary; its returned snapshot is still treated as untrusted data and structurally revalidated. The adapter must return one effective latest review per reviewer.

A successful authority result is still non-writing: `promotionAllowed=false` and `productionWritePerformed=false`. A maintainer-controlled source change and GitHub protected-branch enforcement remain mandatory. See `PROTECTED_SOURCE_CONTROL_REVIEW_AUTHORITY.md`.
