# Hoid EPUB import lifecycle guard

## Purpose

Run 150 adds a small lifecycle guard for asynchronous work started by the reader-facing EPUB import panel. It prevents a picker or package-inspection promise from updating React state after the panel has unmounted, and prevents an older operation from overwriting a newer selection.

## Contract

`createHoidImportLifecycleGuard()` exposes four operations:

- `activate()`: opens a screen lease and returns its identity.
- `beginOperation()`: creates a new monotonically increasing operation token, invalidating earlier tokens.
- `isCurrent(token)`: returns true only for the latest operation while the owning screen lease is active.
- `deactivate(lease)`: invalidates all outstanding operations for that lease. A stale cleanup lease cannot deactivate a later activation.

The lease model tolerates React development Strict Mode's setup-cleanup-setup cycle.

## Import-panel behavior

- A picker result that arrives after unmount is released immediately instead of being retained.
- A package-inspection result that arrives after unmount or after a newer operation is discarded.
- The active source ID remains in a ref and is released on unmount or explicit release.
- Cache cleanup remains best-effort and is delegated to the provider, which deletes only URIs under the app-owned cache directory.
- No source URI, EPUB bytes, chapter text or reading progress is stored by the lifecycle guard.

## Security and spoiler boundary

The guard controls only asynchronous UI lifecycle. It does not authorize a work, edition, chapter, evidence item or editorial record. Package candidates remain ephemeral; chapter allowlists, SQLite progress and production knowledge are unchanged.

## Validation

`epubImportLifecycle.test.ts` covers inactive work, latest-operation wins, unmount invalidation, stale cleanup leases, Strict Mode reactivation and explicit invalidation. The explicit-import workflow runs this suite and type-checks the guard with the import panel and HoidScreen.
