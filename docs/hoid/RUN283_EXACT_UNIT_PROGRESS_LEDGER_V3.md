# Run 283 — exact-unit progress ledger v3

## Purpose

Introduce a provider-neutral, versioned ledger contract for the exact-unit cursor created in Run 282. This is a parallel v3 core contract, not a replacement for the existing v1/v2 stores and not yet a native SQLite migration.

## Data model

A v3 snapshot contains one position per work:

- an edition-bound `HoidUnitProgressCursor` for the currently open unit; or
- an explicit `completed: true` attestation for the whole work.

The cursor's validated boundary records the preceding contiguous ordinal prefix. The current unit is not treated as completed merely because it is open.

## Mutation policy

- Initial positioning requires an explicit reader confirmation. It may start at a later verified unit because the user is attesting that the preceding units have already been read.
- Ordinary advance requires explicit confirmation and exactly the next ordinal. It cannot skip units or move backwards.
- Correction is a separate explicit action and can replace the current cursor with another verified unit.
- Whole-work completion is always a separate explicit attestation. A final numbered chapter does not prove that unnumbered epilogues, appendices, or other EPUB sections have been read.
- Every write uses revision-based atomic compare-and-swap. A stale revision returns a conflict and the latest valid snapshot when available.
- Storage, clock, cursor, or snapshot validation failures fail closed.

## Provider and storage boundaries

The ledger depends only on the `HoidUnitProgressStore` port. It does not import SQLite, Expo, React, a model SDK, or a network client. A conforming durable adapter must implement atomic compare-and-swap across all writers sharing the store.

The test suite uses an in-memory adapter to verify the contract and cross-writer CAS behavior. No production durable v3 adapter is introduced in this run.

## Spoiler boundary

The ledger persists exact structural identity and explicit reader progress only. It does not store prose, summaries, claims, EPUB locators, or provider output. The cursor validator rechecks edition identity and the contiguous manifest prefix. This ledger does not itself authorize narrative evidence; runtime integration must independently map the validated completed boundary to evidence-unlock policy.

## Migration and integration status

- Existing v1 and v2 ledgers are unchanged.
- No data is migrated or rewritten.
- Existing Atlas progress and current authorization runtime remain unchanged.
- The v3 contract is not yet wired to the Expo SQLite store or UI.
- A later migration must preserve the source payload, use an atomic transaction and migration receipt, detect mixed-version writes, and fail closed on ambiguous or partial manifests before v3 can become authoritative.

## Validation

The dedicated workflow runs `unitProgressLedger.test.ts` and strict TypeScript checks for the ledger and its exact-unit cursor dependencies.
