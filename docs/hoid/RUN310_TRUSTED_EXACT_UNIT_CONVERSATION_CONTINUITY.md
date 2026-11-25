# Run 310/311 — trusted exact-unit conversation continuity and single-flight follow-ups

## Purpose

Bind a follow-up to the exact answer that the trusted host actually presented. A caller must not be able to manufacture or widen a chapter scope by supplying arbitrary conversation metadata.

## Capability lifecycle

1. `prepare()` produces an opaque prepared-answer object whose answer text remains in a host-owned `WeakMap`.
2. `present()` reloads the signed reviewer registry and claim bundle, installs invalidation subscriptions, verifies the durable progress receipt, and synchronously hands the answer to the trusted sink.
3. Only after the sink returns successfully and the presentation remains active does the host mint a `HoidTrustedFollowUpCapability`.
4. The capability is an identity-only object. Its chapter scope, work scope, claim IDs, entity IDs, progress receipt and trust fingerprints remain in private `WeakMap` state.
5. `prepareFollowUp()` accepts only a new question, intent and explanation depth. It rejects caller-supplied chapter, work, entity or conversation scopes.
6. The host revalidates the capability, signed bundle, registry revision, edition-bound chapter references and prior progress receipt before invoking the current trusted runtime.

A follow-up answer can itself be presented and receive a new capability. The new capability is minted from that newly presented answer, not copied from caller state.

## Concurrent follow-up attempts

The host applies a process-local single-flight guard to each opaque capability. The guard is acquired synchronously before the first asynchronous operation, so two callers cannot both launch provider selection from the same presentation at once. A concurrent attempt receives `follow-up-in-progress` and does not create provider work.

The guard is released in `finally` on success, validation failure, provider failure or cancellation. It is deliberately not a single-use token: after one attempt finishes, a later sequential follow-up may still branch from the same active parent presentation. Presenting a child creates its own capability and lineage. Revocation of the parent still invalidates in-flight work and every descendant.

This is a per-host concurrency control, not a cross-process lock. The capability itself remains process-local and is never serialized.

## Chapter scope derivation

The host derives the follow-up scope from the `source` references in the exact evidence citations of the presented answer. It does not use `firstSafeAppearance` or `unlock` as retrieval anchors. Those remain independent authorization prerequisites inside the evidence runtime.

The derived scope is canonicalized against the current reading manifests. It is bound to the complete set of cited works and exact chapter identities. An unavailable, ambiguous, stale or oversized reference set yields no continuation capability.

## Provider boundary

The provider receives only the existing bounded selection request: the question, intent, approved candidate claims, selection budget and metadata-only conversation context (prior claim IDs, entity IDs and book IDs).

The provider never receives:

- chapter references or chapter ordinals;
- unit IDs or identity fingerprints;
- EPUB navigation locators or navigation hashes;
- the progress receipt or trust-registry checkpoint;
- the opaque continuation capability or its private sidecar.

The chapter scope is applied locally before candidate selection. It is not a provider-controlled authorization decision.

## Invalidation and failure behavior

The capability is revoked when its owning presentation is cleared, disposed, evicted, or invalidated by progress, trust-checkpoint or signed-bundle changes. A prepared child remains bound to its parent until it is presented; if the parent is cleared before then, child presentation is rejected. Once a child is presented, the active-presentation graph records that parent relationship. Clearing an ancestor recursively retracts descendants and revokes their capabilities.

An in-flight follow-up rechecks that the same capability still exists after asynchronous trust loading, progress verification and provider selection. If the parent presentation is invalidated during provider work, the follow-up result is discarded. The same lineage check is repeated during the child's own presentation, closing the gap between preparation and handoff.

The host fails closed for invalid capabilities, stale progress, changed bundles, stale edition manifests, invalid references, provider failures and malformed requests. A failed follow-up never broadens its chapter scope as a fallback.

## Tests

The host test suite covers:

- no capability before successful presentation;
- capability minting only after the synchronous trusted handoff;
- successful follow-up preparation and capability rotation;
- absence of chapter references and locators from provider requests;
- rejection of caller-supplied chapter and entity scopes;
- revocation when the owning message is cleared;
- revocation after a durable progress change without a notification;
- discarding a follow-up invalidated while provider selection is in flight;
- rejecting a prepared child after its parent is cleared;
- recursively retracting already-presented descendants when an ancestor is reset;
- blocking a second concurrent provider selection from the same capability while permitting a later sequential follow-up.

## Limits

The capability is intentionally process-local and non-persistent. A process restart, screen reset or history hydration must not recreate it from serialized UI data. A future trusted host may re-issue a new capability only after it has independently revalidated and presented the underlying answer again.

This run does not integrate the new API into `HoidScreen`, implement native cross-process progress notifications, or activate production narrative knowledge. It does not inspect, copy or upload EPUB bodies. The user-supplied Cosmere and Roshar bibliography remains a source catalogue; narrative claims still require accessible, reviewed and signed evidence.
