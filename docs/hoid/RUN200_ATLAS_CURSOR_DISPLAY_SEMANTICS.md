# Run 200 — Atlas current-chapter projection

## Finding

The cursor-native Atlas integration workflow exposed two failing assertions in
`cursorAtlasAdapter.test.ts`. The v2 cursor identifies the chapter currently
open, but the adapter had routed that value through
`cursorToLegacyReadingPosition()`, whose contract is intentionally different:
it converts chapter N into the last completed chapter N-1 and returns null for
chapter 1.

That conversion is correct for legacy completed-through authorization. It is
not correct for the Atlas UI field `capituloActualPorLibro`, which stores the
currently open chapter and is consumed by the Community screen's
`isChapterBeyondCompletedReadingBoundary()` filter. That filter itself
subtracts one before deciding whether a community post is safe to reveal.
Passing N-1 into it would subtract twice and hide an additional completed
chapter; returning null for chapter 1 would also incorrectly make a valid
first-chapter cursor look unavailable.

## Change

`atlasProgressFromCursorSnapshot()` now uses the already-validated,
edition-bound `position.cursor.chapterNumber` for the display-only
`chaptersByBook` map.

The projection still:
- validates the entire v2 snapshot before projecting anything;
- preserves explicit completion separately in `completedByBook`;
- uses null-prototype maps and immutable return values;
- fails closed for invalid snapshots;
- remains display-only and must never authorize narrative evidence.

The legacy helper remains unchanged. Its N -> N-1 behavior is required by
legacy completed-through authorization paths. The Community screen receives N
and delegates the exclusive N-1 boundary to
`isChapterBeyondCompletedReadingBoundary()`.

## Regression coverage

The adapter tests now explicitly distinguish the two meanings:

- an open chapter 12 displays as chapter 12 in Atlas;
- the same cursor maps to completed-through chapter 11 only through the legacy
  compatibility helper;
- a community post reaching chapter 12 remains shielded while chapter 12 is
  open, while a post ending at chapter 11 is eligible;
- an open chapter 1 remains visible in Atlas and its own chapter remains
  shielded, even though no completed-through legacy chapter exists;
- multiple works retain independent current positions;
- explicit book completion never fabricates a final chapter.

## Validation

The failing Run 199 workflow reported 90 passing tests and two failures in
`cursorAtlasAdapter.test.ts`. The failures showed a real contract mismatch
between the tests and the adapter: the tests expected the current open chapter,
but the adapter returned the completed-through compatibility value.

Run 200 corrects the display projection and adds regression coverage that
connects it to the Community spoiler boundary. The branch must remain draft
until GitHub Actions completes successfully on its final HEAD, including the
cursor-native Atlas integration workflow and strict TypeScript checks.

## Source and spoiler policy

This change touches only progress projection code, tests and documentation.
It does not inspect or alter any EPUB, XHTML, chapter locator, editorial
summary, claim, approval or reader cursor. No copyrighted passage or private
source path is added.
