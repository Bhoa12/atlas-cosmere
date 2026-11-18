# Run 142 — reviewed topic assignment activation

## Purpose

Topic assignments are source-controlled editorial metadata that group already-approved claims by subject, world, topic and dimension. Run 133 added a pre-merge protected-review authority, but production recommendation code still consumed the assignment array directly. That left a missing lifecycle boundary: a structurally valid assignment registry was not required to carry a post-merge activation receipt.

Run 142 adds that boundary. Production recommendation entry points now require an exact receipt bound to the assignment registry and its verified source-document identities.

## Two separate phases

### 1. Pre-merge review authorization

Use the existing buildHoidTopicAssignmentPromotionPlan() and authorizeHoidTopicAssignmentPromotion() flow.

The protected-review authority verifies the exact PR head, fixed promotion manifest, effective branch/ruleset protection, approval quorum, stale/dismissed reviews, author exclusion, Code Owner policy and authenticated assignment reviewers. The result is only ready-for-maintainer-commit; it never writes production or merges a PR.

The authorization now carries both assignmentFingerprint and evidenceFingerprint. The latter binds source work, chapter, locator, unlock threshold, edition ID, navigation digest, inspected chapter-document digest and first-safe-appearance document identity.

### 2. Post-merge activation receipt

After the reviewed assignment PR is actually merged into main, a trusted read-only source-control adapter implements HoidTopicAssignmentMergeReviewPort.fetchMergedPromotionSnapshot().

The adapter must query GitHub rather than trust caller-supplied metadata. It returns the exact merged PR state, target branch, reviewed head SHA, merge commit SHA, fixed promotion manifest path, plan fingerprint and canonical merge timestamp.

authorizeHoidTopicAssignmentActivation() first calls the existing authorizeHoidTopicAssignmentPromotion() with the plan, exact assignments, review request, read-only source-control port and authoritative progress port. It proceeds to the merge adapter only if that pre-merge authority verifies the protected PR head and all assignment reviewers. It then asks the merge adapter for the post-merge snapshot and builds a metadata-only HoidTopicAssignmentActivationReceipt only when:

- the PR is closed and merged, not a draft;
- the target branch is exactly main;
- repository and PR number match the pre-merge authorization;
- the merged PR head SHA is exactly the reviewed head SHA;
- the promotion manifest path and plan fingerprint match;
- the current assignment registry has the same assignment and evidence fingerprints;
- every assignment reviewer is among the authenticated approvals;
- the approval count meets the verified quorum.

The operation is read-only. It returns ready-for-maintainer-receipt, productionWritePerformed: false. A maintainer must commit the receipt through a separate protected source change. No API in this module writes the production registry or merges a PR.

## Stable registry fingerprint

fingerprintHoidTopicAssignmentRegistry() produces a progress-independent identity for the validated registry:

- canonical assignment IDs and reviewer IDs;
- exact assignment-field fingerprint;
- evidence fingerprint including edition, navigation and individually verified chapter-document digests.

This is intentionally separate from the promotion plan fingerprint. The promotion plan remains bound to the reviewer progress snapshot used during approval; the activation receipt remains stable across readers. Each reader's progress is still checked independently by the evidence runtime before a recommendation can be shown.

## Runtime activation gate

resolveHoidTopicAssignmentsForActivation() validates the current assignment registry and receipt together.

Possible outcomes:

- inactive / no-topic-assignments: the registry is empty;
- inactive / activation-receipt-missing: assignments exist but no receipt has been committed;
- invalid: the receipt is malformed, its fingerprint is wrong, or it no longer matches the assignment/evidence registry;
- active: the receipt and exact registry match.

composeProductionHoidTopicRecommendations() and HoidTopicInterestRecommendationGateway now consume only the active result. A non-empty but unactivated registry is not treated as a recommendation source. The gateway returns assignments-not-activated and does not invoke the local claim-answer port.

The production constant HOID_TOPIC_ASSIGNMENT_ACTIVATION_RECEIPT is currently null, and HOID_APPROVED_TOPIC_ASSIGNMENTS remains empty. Production recommendations therefore remain inactive.

## Trust model and limitation

The receipt fingerprint provides integrity and exact registry binding; it is **not a cryptographic signature** and does not independently authenticate GitHub. Authentication occurs in the pre-merge protected-review authority and the trusted read-only GitHub adapter that fetches the actual merged PR and manifest. The receipt must only be committed after that verification, through the repository's protected main branch. Branch protection and human maintainer review are the trust anchor.

Do not generate receipts from synthetic fixtures for production. Do not treat review.status, reviewer IDs in assignment records, a ready plan, or a receipt hash by itself as proof of approval.

## Spoiler policy

The activation receipt does not authorize narrative disclosure for a reader. It only activates a reviewed grouping of approved claims. Each recommendation still passes through the strict local claim renderer, source-aware answer presentation and same-work chapter unlock checks. Cross-book evidence uses AND semantics: one locked source withholds the complete claim. An open chapter is not a completed chapter.

Changing a reader's progress does not alter the stable activation receipt; it invalidates the recommendation request through the existing SQLite v2 revision/fingerprint checks and causes evidence to be re-evaluated for that reader.

## Source and copyright handling

The receipt contains only repository/PR identifiers, commit SHAs, reviewer IDs, assignment IDs, fingerprints and timestamps. It contains no EPUB bodies, XHTML, passages, summaries or images. Private source files remain outside Git. No narrative claim or topic assignment may be invented from the bibliography or an uninspected passage.

## Validation

Run:

```sh
npx vitest run \
  src/hoid/topicAssignmentActivation.test.ts \
  src/hoid/topicAssignmentPromotionAuthority.test.ts \
  src/hoid/topicRecommendations.test.ts \
  src/hoid/topicInterestRecommendationsGateway.test.ts
```

The dedicated workflow also performs strict TypeScript checks through the production recommendation gateway, local approved-claim renderer and HoidScreen.tsx.
