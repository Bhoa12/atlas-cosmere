# PROGRESS CONSISTENCY CONTRACT

This document defines consistency rules for structural reading progress before it
can influence spoiler-sensitive UI.

## States

Progress is represented by the reusable states `blocked`, `not-started`,
`in-progress` and `complete`.

A state is derived from structural coordinates only. It is not evidence of any
editorial fact and does not imply that EPUB text has been inspected.

## Completion contract

A world may be `complete` only when all declared positions are completed and
there is no known next position.

If all positions are marked complete but a next position is still supplied, the
state is treated as `blocked`. This contradiction fails closed so stale or
corrupted progress cannot unlock spoiler-sensitive content.

Malformed counts and ambiguous work identifiers remain `blocked`.

## Editorial boundary

This contract stores no protected text and does not create chapters, summaries,
facts or unlock points. It only validates consistency between declared progress
coordinates.