# Cosmere expansion run 83

This iteration adds a small, reusable domain layer for future Atlas expansion without treating bibliography as editorial evidence.

## Source boundary

The verified index from `cosmere.epub` is represented as title metadata only. The catalog contains the 17 titles supplied by the user. No world, chronology, chapter, or narrative fact is inferred from a title.

Sources are classified as:

- `verified-index`: bibliographic metadata.
- `declared-private`: a private source may exist but has not been treated as inspected.
- `editorial-accessible`: only this kind, when explicitly accessible, may back reading structure or an original summary.

This code does not store or reproduce protected passages.

## Reusable model

The domain separates:

`SourceRecord -> World / Work -> ReadingUnit -> ProgressSnapshot -> SpoilerGate`

World-to-work links are explicit and validated; priority worlds are registered without automatically assigning any catalog work to them.

## Progress and spoiler policy

Progress reconciliation ignores other works and unknown units, removes duplicates, and returns completion in declared reading order.

Spoiler gates are fail-closed. Empty, duplicate, or unknown requirements do not unlock content. A valid gate becomes visible only after every required unit is complete.

## Tests

The test file uses synthetic units and source records. It verifies the catalog size, provenance restrictions, conservative progress reconciliation, and progressive spoiler unlocking.

The implementation intentionally does not claim that any private EPUB passage was consulted. Future reading units and original summaries should only be added when their supporting material is actually accessible in the working environment.
