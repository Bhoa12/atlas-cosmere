# Catalog spoiler access plan

This adapter connects two metadata-only boundaries:

1. `resolveCatalogReadingBoundary` verifies that selected work identifiers
   belong to one explicit world in the verified source catalog.
2. `resolveWorldSpoilerBatchGate` decides which metadata identifiers are
   inside the validated reading frontier.

The adapter is deliberately fail-closed. If either layer rejects the input, the
combined result is `blocked` and exposes no boundary or content identifiers.

## Runtime input boundary

The composition layer treats its top-level work and request collections as
untrusted runtime input. If either collection is malformed instead of being an
array, the plan returns `blocked` rather than throwing or attempting to repair
the data. This keeps the adapter fail-closed when metadata originates from
persistence, import pipelines or future application boundaries.

## Boundary extent

When a catalog boundary is selected, `declaredPositions` must match the number
of selected work identifiers exactly. This prevents a technical spoiler frontier
from claiming a larger or smaller extent than the catalog boundary it is being
used to protect. The check validates only metadata cardinality; it does not
assert editorial order, chapter counts, or narrative structure.

## Scope

The plan does not establish editorial reading order. Callers supply work
identifiers and technical positions; those values remain metadata contracts.
This module does not inspect private EPUB files, store chapter text, quote
protected material, or infer narrative or canon facts.

## Reuse

The same composition can be used for Scadrial, Sel, Nalthis, Taldain, Roshar
and future worlds, provided the catalog contains an explicit world assignment.
Entries deliberately left without a `worldId` remain unavailable to this
world-local boundary until a separate reviewable metadata decision exists.
