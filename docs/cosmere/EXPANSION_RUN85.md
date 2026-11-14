# Cosmere expansion run 85

This iteration adds a compact, reusable domain layer for the Atlas:

`Source -> Work -> explicit WorldWorkLink -> ReadingUnit -> ProgressSnapshot -> spoilerGate`.

## Catalog boundary

The verified index supplied for `cosmere.epub` is represented only as title metadata. Titles do not imply:

- a world assignment;
- chronology;
- chapters or other internal reading units;
- narrative facts or summaries.

The Roshar EPUBs may be registered as private sources, but a private source that is not accessible in the runtime cannot back reading structure or editorial summaries.

## Reading structure

`safeReadingUnits` accepts only units backed by an accessible `editorial-accessible` source. This prevents the catalog from silently becoming invented chapter data.

## Progress and spoilers

Progress is reconciled per work and ignores unknown units and snapshots from other works. `spoilerGate` is fail-closed: empty, duplicated, unknown, or incomplete requirements remain locked.

## Tests

The accompanying tests use synthetic data only. No protected text is copied into the repository.
