# Hoid Run 335 — explicit reading focus

## Objective

Provide one provider-neutral, book-and-chapter-aware focus for the current conversation without guessing which work the reader means when several works are active.

## Contract

`src/hoid/readingFocus.ts` exposes:

- `resolveHoidReadingFocus({ progress, selectedBookId? })`
- `validateHoidReadingFocus(focus, progress)`

The resolver accepts only an exact plain-data request and a valid cursor-v2 progress snapshot. A single active work may be selected implicitly. When more than one work is active, the resolver returns `selection-required` with metadata-only choices; it never chooses by array order, series order, or most-recent display position. A caller can resolve the focus only by supplying an explicit catalogued `selectedBookId` that is already present in progress.

## Chapter semantics

For an in-progress cursor at chapter N:

- `currentChapter` is N, the chapter currently open in Atlas.
- `completedThroughChapter` is N - 1.
- Chapter one therefore has no completed chapter.
- The focus never describes the open chapter as completed.

For explicit whole-work completion, the focus reports `completedThroughEntireWork: true` and does not invent a final chapter number.

The chapter count comes from the verified reading manifest. For partially segmented editions it is capped before the first ambiguous numbered chapter.

## Data minimization

The focus contains only:

- catalog book ID and title;
- edition and manifest identity;
- verified manifest coverage and safe numbered chapter count;
- current and completed-through chapter metadata;
- progress revision and SHA-256 fingerprint.

It excludes raw cursors, unit IDs, EPUB locators, source bytes, chapter bodies, summaries, aliases, claims and evidence IDs. It is a local display/context projection and must not be treated as a provider payload.

## Security boundary

A focus has `authorizationEffect: "none"`. It cannot:

- unlock evidence or a chapter;
- change the progress ledger;
- authorize a source summary;
- broaden a single-work answer into a cross-work answer;
- replace the exact chapter/evidence checks performed by the trusted answer host.

Every use of a previously resolved focus must call `validateHoidReadingFocus` against the current progress. A changed revision, fingerprint, selected work or edition manifest makes the focus stale and requires a fresh resolution.

Malformed snapshots, unknown books, accessor-backed records, duplicate positions, stale cursors, absent active works and unsegmented editions fail closed.

## Source policy

This run does not read private EPUBs or add narrative claims. It uses only the already registered bibliography and verified edition manifests. The focus is structural metadata, not a substitute for an accessible chapter source.

## Validation

`src/hoid/readingFocus.test.ts` covers implicit single-work resolution, explicit selection, multiple-work ambiguity, chapter-one boundaries, whole-work completion, invalid/stale progress, accessor rejection, focus tampering and metadata minimization.
