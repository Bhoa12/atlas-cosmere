# Run 285 — exact-unit v3 progress coordinator

## Objective

Add a provider-neutral coordinator for the v3 exact-unit progress ledger. It mirrors the lifecycle guarantees already used by the v2 cursor coordinator without replacing that coordinator or making v3 the active Atlas progress authority.

## Responsibilities

- Own one `HoidUnitProgressLedger` instance over a caller-owned `HoidUnitProgressStore`.
- Serialize mutations issued through the same coordinator.
- Refresh the durable ledger before every mutation and compare the caller's expected revision with the latest snapshot.
- Delegate all cursor, contiguous-prefix, confirmation, completion, and compare-and-swap rules to the v3 ledger.
- Expose `initialize()`, `refresh()`, `getSnapshot()`, and a payload-free `subscribe(listener)` API.
- Notify listeners only after a committed snapshot changes, when a refresh discovers a different durable snapshot, when a previously available snapshot becomes unavailable, or when the coordinator is disposed.
- Isolate listener exceptions from committed writes.
- Treat a null snapshot after a failed refresh as authoritative; callers must not fall back to a stale UI copy.

## Concurrency model

The coordinator serializes its own operations through a promise queue. This is only an in-instance ordering guarantee.

Cross-instance correctness remains the responsibility of `HoidUnitProgressStore.compareAndSwap()`, which must be atomic across all coordinators sharing the same durable database.

Every mutation follows this order:

1. Refresh the store and validate the v3 snapshot.
2. Compare the caller-provided expected revision with the latest durable revision.
3. Delegate to the ledger, which independently re-reads and performs compare-and-swap.
4. Publish a payload-free change event only after the ledger returns a committed, changed snapshot.
5. On conflict, refresh and return the latest validated snapshot; never retry the user's operation automatically.

This double validation closes stale-screen and cross-coordinator races without weakening the ledger's own CAS boundary.

## Change subscription

The listener receives no event payload. A consumer must reload the coordinator snapshot and revalidate its own request context.

The contract does not claim spontaneous cross-process notifications. A different coordinator's write is discovered only when this coordinator calls `refresh()` or performs a mutation (which refreshes first).

A gateway should install the subscription before asynchronous work, refresh immediately after installing it, abort or invalidate work when notified, and perform a final durable refresh before presenting a response. The event is an invalidation signal, never a reading grant.

## Privacy and spoiler boundary

- The coordinator does not depend on Expo, SQLite, React, a model SDK, or network services.
- It does not call a provider or pass progress metadata to a provider.
- It does not expose locator IDs; chapter references contain edition-bound identity metadata only.
- The snapshot is an internal local contract. It must not be serialized into provider requests or public conversation history.
- The current unit remains open, not completed. Only its verified preceding ordinal prefix is complete.
- Exact duplicate chapter labels remain distinct through unit ID, ordinal, and edition fingerprint.
- The coordinator never projects an ambiguous unit into a numeric chapter permission.
- Whole-work completion still requires an explicit reader attestation.
- The coordinator does not authorize evidence. EvidenceRuntime must independently enforce progress, first-safe-appearance, evidence-unlock, provenance, and editorial approval.

## Failure behavior

- Invalid/stale expected revisions return a conflict or rejection; the coordinator never retries silently.
- Ledger/storage errors return an unavailable result.
- If a refresh fails after a previously valid snapshot was cached, the cached snapshot is cleared and listeners are notified.
- A disposed coordinator clears its snapshot, notifies existing listeners once, and rejects future operations.
- Listener exceptions are swallowed and cannot roll back a successful durable write.

## Integration status

This run adds the v3 coordinator contract and tests only. It does not wire v3 into `CosmereContext`, `HoidScreen`, the current v2 `HoidConversationGateway`, or EvidenceRuntime.

The existing v2 cursor coordinator remains the active Atlas progress authority. The new v3 coordinator is ready for a later integration run after a v3-native evidence projection/runtime has been defined. In particular, no unsafe conversion from an ambiguous ordinal cursor to a legacy numeric chapter permission is permitted.

No private EPUB is inspected or modified. Tests use synthetic metadata fixtures. No protected prose, chapter text, or summaries are added.

## Verification

The dedicated workflow runs:

- v3 coordinator tests;
- v3 ledger and exact-unit cursor regression tests;
- the v2 -> v3 SQLite migration and CAS regression suite;
- strict TypeScript checking over the coordinator, ledger, cursor, and SQLite persistence boundary.

CI transaction doubles do not replace Android/iOS native SQLite restart, rollback, or interruption tests.
