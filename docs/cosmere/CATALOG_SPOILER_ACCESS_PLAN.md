# Catalog spoiler access plan

This adapter connects two metadata-only boundaries:

1. `resolveCatalogReadingBoundary` verifies that selected work identifiers
   belong to one explicit world in the verified source catalog.
2. `resolveWorldSpoilerBatchGate` decides which metadata identifiers are
   inside the validated reading frontier.

The adapter is deliberately fail-closed. If either layer rejects the input, the
combined result is `blocked` and exposes no boundary or content identifiers.

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
