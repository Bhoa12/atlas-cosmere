# Bibliography world assignments

This boundary connects bibliography entries to world identifiers only through
explicit metadata supplied to the application.

## Contract

- Every `sourceId` must exist in the declared source catalog.
- A source can appear at most once in an assignment batch.
- Empty source or world identifiers block the batch.
- Missing assignments are allowed: the resolver does not guess a world.

The module deliberately does not infer world membership from titles, filenames,
series labels, chronology, or narrative knowledge. A valid assignment is
structural metadata only; it does not prove that a private EPUB was read, does
not create narrative evidence, and does not authorize spoiler-sensitive
content.

This keeps world expansion reusable for Scadrial, Sel, Nalthis, Taldain, Roshar
and future worlds while preserving provenance and fail-closed behavior.
