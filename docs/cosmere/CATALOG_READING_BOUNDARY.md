# Catalog Reading Boundaries

`resolveCatalogReadingBoundary` connects the verified source catalog to later
reading-progress and anti-spoiler layers without importing editorial content.

## Contract

A boundary is resolved only when:

- the world identifier is non-empty and canonical;
- at least one work identifier is supplied;
- every work exists in the verified catalog for that same world;
- no work identifier is duplicated.

Invalid input returns `null`. The resolver does not trim, repair, reorder or
infer metadata.

## Scope

The boundary preserves the caller's supplied work order as metadata but does
not claim that order is an editorial reading order. It does not inspect EPUB
files, chapter text, quotations, summaries or narrative facts.

Unassigned catalog entries remain unavailable through a world boundary until a
separate, reviewable metadata decision assigns them.
