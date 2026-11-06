# WORLD_PROGRESS_STATUS

`resolveWorldProgressStatus` converts structural world progress coverage into a
small UI-safe state: `blocked`, `not-started`, `in-progress` or `complete`.

## Fail-closed validation

A world is `blocked` when work identifiers are ambiguous or when progress
counts are malformed. Counts must be safe integers, declared positions must be
positive, and completed positions must be between zero and the declared total.

This prevents incomplete or corrupted structural data from being presented as a
finished reading state.

## Editorial boundary

This utility evaluates only structural progress coordinates. It does not read
EPUB text, infer chapters or narrative events, or verify editorial claims.
Bibliographic availability remains separate from evidence-backed content.
