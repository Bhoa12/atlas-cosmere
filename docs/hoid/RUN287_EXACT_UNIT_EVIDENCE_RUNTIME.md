# Run 287 — exact-unit evidence runtime

## Objective

Introduce a provider-neutral answer runtime that uses the v3 exact-unit progress ledger and the ordinal evidence authorizer before invoking the existing claim selector. The existing v2 conversation gateway and numeric runtime remain untouched.

## Runtime boundary

HoidUnitEvidenceRuntime accepts:

- the v3 HoidUnitProgressCoordinator;
- metadata-only HoidKnowledgeEntry records with verified original summaries;
- editorially attested claims;
- one exact HoidUnitEvidencePolicy per evidence item;
- an optional provider-neutral HoidClaimSelector.

At configuration time it canonicalizes the knowledge and claim registries, validates every exact policy against the current edition references, and requires exact source, first-safe-appearance and unlock references to agree with the reviewed metadata.

At answer time it:

1. refreshes and validates the durable v3 snapshot;
2. authorizes every evidence policy against the completed ordinal prefix;
3. blocks a question that matches an entity whose evidence is not unlocked;
4. validates exact chapter references and requires them to be completed;
5. constructs a request-local subset containing only fully authorized knowledge and claims;
6. invokes the existing selector protocol with claim candidates only;
7. refreshes progress after asynchronous selection;
8. rejects the result if revision or snapshot fingerprint changed;
9. reauthorizes every selected evidence item;
10. reconstructs citations from exact chapter references rather than legacy numeric citations.

The currently open unit is never counted as completed. A progress change during provider work aborts the local request when the coordinator observes it, and the post-invocation refresh remains the authoritative freshness check.

## Legacy runtime containment

The existing HoidEvidenceRuntime is reused only as a request-local selector/renderer over the already-authorized subset. Its secondary reading filter receives a conservative projection of the same v3 completed prefix only when that prefix has an unambiguous numeric representation. An explicitly completed v3 work remains explicitly completed. A cursor whose completed prefix cannot be represented without collapsing duplicate labels is excluded from this compatibility bridge.

No synthetic whole-work completion is manufactured. The projected positions are request-local, are not persisted, are not returned to the UI, and are never sent as raw progress to the provider.

This is a compatibility bridge, not a new authorization source. The v3 exact-unit prefilter and post-selection reauthorization remain authoritative. The legacy runtime cannot see evidence or claims that the exact-unit gate did not admit.

Provider egress remains limited to the existing versioned selection request: question, approved candidate text, claim/evidence IDs, selection budget and a one-way request fingerprint. Unit IDs, edition fingerprints, chapter references, source locators and raw progress are not included.

## Presentation freshness

Every ready result carries a revision and SHA-256 snapshot fingerprint. The host must call verifyForPresentation() immediately before rendering. That method refreshes durable progress, compares the receipt and reauthorizes all cited evidence. A stale receipt or newly locked evidence is withheld.

The receipt is a freshness token, not a signature or authentication credential.

## Context and recommendations

readingContext() exposes metadata-only current work positions, including both visible chapter number and ordinal so duplicate labels remain distinguishable.

recommend() prioritizes resuming explicitly active works and then lists unstarted bibliography entries. It does not infer canon order, chronology, crossover dependencies or plot facts from the source catalog.

## Current compatibility limit

The existing approved-claim integrity format still binds firstSafeAppearance and evidenceUnlock as numeric chapter labels. Consequently, this runtime currently rejects duplicate-label thresholds at configuration time even though the standalone v3 authorizer can distinguish them. A future exact-unit claim-attestation format must bind the complete HoidChapterReference identities before duplicate-label evidence can be promoted into this runtime.

The current policy contract also requires source, first-safe-appearance and unlock references to belong to the same work. Cross-work comparisons are supported by combining independently authorized evidence records in one reviewed claim; a single evidence record cannot yet bind a first appearance in one work to a source in another.

The runtime is not yet wired into HoidConversationGateway, HoidScreen or the active v2 Atlas progress authority. It is a separately testable v3 answer boundary. Native SQLite device tests and end-to-end UI integration remain required before activation.

## Tests

The dedicated suite covers:

- exact-unit authorization and exact citations;
- current-open-unit blocking;
- completed exact chapter scopes;
- chapter-scoped evidence filtering;
- progress changes during provider work;
- presentation receipt invalidation;
- metadata-only resume/unstarted recommendations;
- mismatched source identities;
- accessor-backed requests;
- rejection of duplicate-label thresholds under the legacy review binding.

Fixtures are synthetic. No private EPUB, XHTML, passage, chapter title or unverified narrative summary is copied into this change.
