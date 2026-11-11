# Work-scoped spoiler requirement boundary

`workScopedSpoilerRequirement.ts` validates the technical requirements used to unlock protected content.

It composes three existing boundaries:

1. the source catalog establishes known works;
2. the reading-unit registry establishes known technical units;
3. work progress establishes which registered units belong to one declared work.

A spoiler requirement is accepted only when its work exists and every required unit exists in the validated registry and belongs to that same work.

## Fail-closed behavior

Malformed IDs, duplicate requirements, unknown works, invalid registries, unknown units and cross-work unit references are blocked. The boundary never repairs identifiers or guesses ownership.

## Editorial boundary

This module does **not** define chapters, pages, official reading order, chronology, world membership, characters or plot. It can protect future original summaries without reading or storing protected source text.
