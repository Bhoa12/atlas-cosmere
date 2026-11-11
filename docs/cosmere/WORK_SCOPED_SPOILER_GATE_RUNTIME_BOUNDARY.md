# Work-scoped spoiler gate boundary

This boundary composes validated reader progress with protected content.

It accepts a technical `workId`, required technical unit identifiers and an opaque payload. Progress is first validated against the source catalog and reading-unit registry.

The gate fails closed when progress, catalog references or identifiers are invalid. Content from a different technical work is never unlocked by progress belonging to another work.

## Editorial limits

This layer does not determine chapters, pages, official reading order, world membership, chronology or narrative facts. It does not inspect private EPUB text. Payloads remain opaque to the infrastructure.

Future verified metadata for Scadrial, Sel, Nalthis, Taldain, Roshar or other worlds can reuse this boundary without changing those limits.
