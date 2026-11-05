# Spoiler gate catalog coverage

`validateSpoilerGateCatalogCoverage` checks explicit anti-spoiler requirements against the technical reading structure declared in the catalog.

It reports two structural problems:

- a requirement references a work that is not declared;
- a requirement references a reading position that is not explicitly declared for that work.

The validator is intentionally conservative. It does not infer chapters, clamp a position to the nearest unit, create missing checkpoints, or derive narrative dependencies. This makes it safe to use while the catalogs for Scadrial, Sel, Nalthis, Taldain and other worlds are still being expanded from verified metadata.

The validator works only with IDs and declared coordinates; it does not inspect or reproduce protected EPUB text.
