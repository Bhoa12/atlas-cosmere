# Spoiler-safe content gate

`canRevealSpoilerSafeContent` is the final conservative gate for narrative
content that depends on reader progress.

A reveal requires all of the following:

1. the source identifier appears exactly once in a valid bibliographic manifest;
2. the content is explicitly marked `summary-backed`;
3. the required reading unit is declared;
4. the reader has completed that unit through a consistent, contiguous progress
   record.

The gate is deliberately **fail-closed**. `declared` bibliography,
`unverified` evidence, and `structure-only` evidence never grant permission
to reveal narrative content.

## Editorial boundary

This module stores no passages, quotations, chapter text, or narrative facts.
The `summary-backed` state is a caller-supplied evidence classification; it
does not itself prove that a source was accessible. Callers must only assign it
when an original summary has been backed by accessible evidence. If evidence is
not available, the safe state is to keep the content unrevealed.
