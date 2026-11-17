# Cursor-native progress coordinator

## Purpose

HoidCursorProgressCoordinator is the provider- and platform-independent write boundary for the v2 cursor snapshot. It sits above HoidCursorProgressStore and below Atlas UI actions.

It does not open SQLite, import Expo, call an AI provider, inspect EPUB prose or decide editorial truth.

## Operations

- advance(bookId, cursor): accepts only a cursor that validates against the current edition manifest. It permits forward movement and an idempotent repeat; it rejects backward movement and completed works.
- complete(bookId): records an explicit reader-declared completion. Reaching the final numbered chapter never completes a book automatically.
- reopenCompletedWork(bookId, confirmation): requires an explicit confirmation object and starts at chapter one only when the edition exposes a verified first unit.
- correctCursor(bookId, cursor, confirmation): applies a deliberate correction only after explicit confirmation. Reopening a completed work additionally requires reopenCompleted: true.

The current manifest contract contains numbered chapters only. Reopening an unsegmented collection therefore fails instead of inventing a cursor.

## Concurrency and consistency

Operations issued through one coordinator instance are serialized. The store compare-and-swap operation remains authoritative across multiple coordinator instances or connections.

When compare-and-swap loses a race, the coordinator reloads the store, validates the returned snapshot and returns a conflict containing the current revision. It never retries a user action against a different revision implicitly.

Every committed mutation increments the revision exactly once, preserves the original first-read order for an existing work, and records a canonical ISO timestamp. Invalid clocks, revision exhaustion, corrupt snapshots and storage failures fail closed.

## Composition boundary

expoCursorProgressCoordinator.ts opens the native Expo SQLite database and injects the existing SQLite cursor store into the coordinator. Web is rejected until a separately tested transactional store exists.

The native factory is now composed by CosmereContext. Its v2 snapshot is authoritative for Atlas progress and is passed directly to HoidScreen. The v1 row is retained only as the immutable migration source and divergence guard; there is no fallback to v1 after cutover. Reopen confirmation is presented by the Atlas UI before the coordinator is invoked. Device-level restart and interruption testing remains a release gate.

## Verification

cursorProgressCoordinator.test.ts uses a deterministic store contract double. It tests forward-only advancement, explicit correction, explicit completion, confirmed reopening, unsegmented works, invalid cursors, concurrent coordinators, serialized operations, conflict refresh and fail-closed storage behavior.

These tests validate coordinator policy. They do not replace integration tests against native SQLite on Android or iOS.
