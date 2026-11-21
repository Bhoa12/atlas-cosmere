# Run 200 — Atlas current-chapter projection

## Finding

The cursor-native Atlas integration workflow exposed two failing assertions in
`cursorAtlasAdapter.test.ts`. The v2 cursor identifies the chapter currently
open, but the adapter had routed that value through
`cursorToLegacyReadingPosition()`, whose contract is intentionally different:
it converts chapter N into the last completed chapter N-1 and returns null for
chapter 1.

That conversion is correct for legacy completed-through authorization. It is
not correct for the Atlas UI field `capituloActualPorLibro`, which displays the
chapter currently open. The mismatch hid the open chapter from the display
projection and caused the two integration assertions to fail.

## Change

`atlasProgressFromCursorSnapshot()` now uses the already-validated,
edition-bound `position.cursor.chapterNumber` for the display-only
`chaptersByBook` map.

The projection still:
- validates the entire v2 snapshot before projecting anything;
- preserves explicit completion separately in `completedByBook`;
- uses null-prototype maps and immutable return values;
- fails closed for invalid snapshots;
- remains explicitly display-only and must never authorize narrative evidence.

The legacy helper remains unchanged. Its N -> N-1 behavior is required to keep
an open chapter from being treated as completed by legacy authorization paths.

## Regression coverage

The adapter tests now explicitly distinguish the two meanings:

- an open chapter 12 displays as chapter 12 in Atlas;
- the same cursor maps to completed-through chapter 11 only through the legacy
  compatibility helper;
- an open chapter 1 remains visible in Atlas even though no completed-through
  legacy chapter exists;
- multiple works retain independent current positions;
- explicit book completion never fabricates a final chapter.

## Validation

The failing Run 199 workflow reported 90 passing tests and two failures in
`cursorAtlasAdapter.test.ts`. The failures were caused by the adapter's
off-by-one projection, not by the cursor manifest or the spoiler authorization
rule.

Run 200 adds regression tests and corrects the display projection. The branch
must remain draft until GitHub Actions completes successfully on its final
HEAD, including the cursor-native Atlas integration workflow and strict
TypeScript checks.

## Source and spoiler policy

This change touches only progress projection code, tests and documentation.
It does not inspect or alter any EPUB, XHTML, chapter locator, editorial
summary, claim, approval or reader cursor. No copyrighted passage or private
source path is added.
