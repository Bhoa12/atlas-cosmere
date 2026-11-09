# Reading-unit manifest

`resolveReadingUnitManifest(...)` is the metadata boundary between validated
world activation and downstream reading features.

## Inputs

Each unit declares only:

- `worldId`
- a stable `unitId`
- a `sourceCatalogEntryId`
- an explicit numeric `order`

The caller must also provide the result of activation-integrity validation.

## Fail-closed rules

The manifest is blocked when activation integrity is unavailable, activation
records are structurally inconsistent, a unit targets a world that is not
activated, identifiers are duplicated, or two units share an order within one
world.

A valid manifest does **not** establish chapter boundaries, prove that source
text was read, expose private EPUB text, or authorize narrative summaries or
spoilers. It is deliberately a structure-only contract.

## Position in the pipeline

`catalog -> coverage -> readiness -> plan -> execution -> reading activation ->
activation integrity -> reading-unit manifest -> progress -> spoiler controls`
