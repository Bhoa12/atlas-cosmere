# Bibliography-to-work assignments

`resolveBibliographyWorkAssignments` provides a small, fail-closed bridge between the private bibliography catalog and application work identifiers.

## Contract

Each relationship is declared explicitly:

- `sourceId` must exist in the supplied source catalog;
- a source may occur at most once;
- a `workId` may occur at most once in a single assignment set;
- empty identifiers block the complete result.

The resolver deliberately does not derive a work from a title, filename, collection name, series label, chronology, or narrative knowledge.

## Editorial boundary

A valid assignment is bibliographic metadata only. It does not assert that the private source was read in the current environment, create narrative evidence, authorize a summary, or bypass anti-spoiler controls.

Narrative claims and user-facing disclosure remain subject to the project's separate evidence, progress, and anti-spoiler layers.
