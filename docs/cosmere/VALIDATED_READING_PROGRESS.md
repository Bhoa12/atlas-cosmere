# Validated Reading Progress

`resolveValidatedReadingProgress` converts explicit completion metadata into a
validated snapshot that can safely feed downstream anti-spoiler checks.

## Boundary

The layer depends on a validated reading-unit manifest and records only explicit
completion. It does not inspect private EPUB text, infer chapters, infer
completion from order, or create editorial facts.

## Fail-closed rules

The snapshot is blocked when manifest validation is unavailable, a manifest unit
is ambiguous, progress references an unknown unit, or a unit appears more than
once. Omitted units remain pending.

The snapshot can provide `completedUnitIds` to spoiler visibility, but the
editorial process remains independently responsible for declaring spoiler
requirements.
