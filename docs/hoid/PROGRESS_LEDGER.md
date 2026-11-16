# Progress Ledger

## Purpose

The progress ledger is the provider-neutral persistence boundary for reader progress. It stores only metadata: work ID, numeric chapter when the inspected edition supports it, explicit completion, optional series order, schema version, revision and update timestamp.

It never stores EPUB passages, chapter titles, summaries, prompts or provider output.

## Contract

`HoidProgressStore` exposes:

- `read()`: returns an untrusted snapshot that must be validated at runtime;
- `compareAndSwap(expectedRevision, next)`: atomically writes only if the stored revision still equals the expected revision.

A production adapter must implement compare-and-swap atomically across all clients sharing the ledger. A read followed by an unconditional write is not compliant.

The core does not select AsyncStorage, SQLite, a remote database or another persistence provider. Those implementations belong in adapters outside `src/hoid`.

## Snapshot schema

- `schemaVersion`: currently 1;
- `revision`: monotonically increasing safe integer;
- `positions`: at most 256 unique, known bibliography work IDs;
- `updatedAt`: canonical ISO-8601 timestamp, or null only for revision zero.

Each work appears once. Numeric progress is checked again against the inspected edition policy. Works without an unambiguous numeric model (including the merged White Sand navigation and Arcanum collection) cannot be advanced through a fabricated chapter integer.

## Update rules

- Every update includes the revision the caller last read.
- A stale revision returns a conflict; it never overwrites a newer snapshot.
- Moving backwards requires `allowRegression: true`.
- Marking a work complete requires `complete: true` and `confirmCompletion: true`.
- Reopening a completed work requires `reopenCompleted: true`.
- A completion flag is stored separately from a chapter number; the ledger does not invent a final chapter.
- Unknown works, unsupported positions, malformed snapshots, storage errors and invalid timestamps fail closed.

An unchanged position does not create a new revision.

## Security properties and limits

The ledger validates its input independently of the UI and never merges duplicate progress positions. Unknown work IDs are rejected instead of silently dropped. Snapshot parsing rejects duplicate IDs, unexpected fields and malformed timestamps.

The revision check protects concurrent updates only when the concrete store provides atomic compare-and-swap. The interface alone cannot make a non-atomic adapter safe.

The current API deliberately supports only the edition's verified numeric positions and explicit completion. A later unit-cursor extension must be backed by a separately reviewed, digest-pinned unit manifest before it can authorize chapter-specific evidence. No cursor is inferred for ambiguous chapters, front matter, interludes, merged volumes or collections in this iteration.

## Integration status

This commit adds the service contract and tests, not a production storage adapter. Atlas must inject a compliant store and pass the canonical snapshot to the strict evidence runtime. Until that integration exists, the ledger must not be described as persistent application storage.
