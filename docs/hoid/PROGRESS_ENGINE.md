# Hoid IA: multi-book progress engine

## Purpose

This module provides a provider-independent, deterministic progress ledger for readers who move between several Cosmere works. It is a domain layer only: it does not read EPUBs, infer chapter positions from questions, call a model, or choose a reading order.

## Data contract

A version-1 ledger contains:

- one global optimistic-concurrency revision;
- at most 100 unique book records;
- one positive chapter position per book;
- a status of `reading`, `paused`, or `completed`;
- the revision at which each book record last changed.

The catalogue is an explicit allow-list of stable book IDs. A `chapterCount` may be supplied only together with `chapterCountVerified: true` and a valid `chapterCountSourceId` identifying the edition's verified chapter index. An unproven count invalidates the catalogue entry. When chapter-count metadata is absent, the engine does not invent an upper chapter bound.

No title, narrative summary, EPUB passage, or provider output is stored in the progress ledger.

## State transitions

- `set-position` creates or advances a book position.
- A position cannot move backwards by default. A correction requires `confirmedCorrection: true`.
- Updating a completed book's position also requires explicit correction confirmation and reopens it as `reading`.
- `set-status` changes an existing record to `reading`, `paused`, or `completed`.
- Marking a book completed requires `confirmed: true`. If a verified `chapterCount` exists, the saved chapter must have reached it.
- Reopening a completed book requires `confirmed: true`.
- Every mutation must include the current global `expectedRevision`. Stale writes are rejected.

These rules are intentionally conservative. A missing chapter count does not block an explicit user-confirmed completion, but the engine never infers completion from an unknown total.

## Spoiler-filter integration

Use `selectBookProgress(ledger, bookId, catalogue)` when preparing a request. It returns the exact progress record for that work or an explicit abstention. Do not substitute another book's position, the latest chapter across all books, or a guessed default.

The selected `{ bookId, chapter }` can be passed to the existing provider/evidence boundary. A missing record returns `no-progress`; callers must ask the reader to set progress rather than silently broaden the authorized scope.

`completedBookIds` exposes only explicitly completed IDs for the metadata-only reading planner. It does not produce narrative explanations.

## Persistence adapter

The core depends only on the `ProgressStore` contract:

- `read()` returns the stored ledger or `null` when no ledger exists.
- `compareAndSwap(expectedRevision, next)` must atomically write only if the stored global revision still equals the expected revision.

`persistProgressCommand` reads, validates, applies the pure reducer, and attempts the compare-and-swap. A concurrent write is reported as `concurrent-update`; storage errors become `storage-failure`. Adapters must not implement this contract as an unconditional overwrite.

The repository does not yet select AsyncStorage, SQLite, or another concrete persistence technology. The adapter can be added by the application without coupling this domain module to a storage vendor.

## Source and privacy policy

The private EPUB bibliography remains a catalogue of works, not proof that every chapter or passage is available. Progress records contain only stable book IDs, chapter numbers, statuses, and revisions. Do not store EPUB text or narrative summaries here. Do not infer progress from chat history or provider output.

If a book ID is not in the supplied catalogue, the command is rejected. If chapter counts are unavailable or unverified, omit them instead of estimating. The engine requires an explicit verification flag and source identifier whenever a count is supplied.

## Checks

Run:

```sh
npx --yes tsx@4.19.2 src/hoid/progressEngine.selfcheck.ts
npx --yes --package typescript@5.3.3 tsc --noEmit --strict --target ES2020 --module commonjs src/hoid/progressEngine.ts src/hoid/progressEngine.selfcheck.ts
```

The self-check covers multi-book isolation, monotonic positions, confirmed corrections, completion and reopening, catalogue bounds, malformed ledgers, per-book selection, completed-book export, optimistic concurrency, and storage failure. It does not claim that a concrete mobile storage adapter or the full Expo app has been integrated.
