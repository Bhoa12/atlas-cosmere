# Work-progress consistency boundary

`workProgressConsistency.ts` validates a reader progress snapshot against one
technical work in the verified source catalog.

A valid snapshot requires:

- a canonical `workId` already present in the catalog;
- a reading-unit registry that passes the existing catalog-reference boundary;
- canonical, unique completed unit IDs;
- every completed unit to belong to the declared work.

The boundary is fail-closed. It does not move units between works, deduplicate
progress, repair identifiers, or infer missing catalog entries.

## Editorial limits

Successful validation establishes only technical consistency between identifiers.
It does **not** establish chapters, pages, official reading order, chronology,
world membership, or narrative facts. It does not inspect private EPUB text.

This boundary can therefore be composed with future progress and anti-spoiler
features without turning reader state into an editorial assertion.
