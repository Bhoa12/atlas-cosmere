# Verified source catalogue runtime boundary

`src/data/sourceCatalogue.ts` is the bibliographic entry point for the expansion architecture.

## What it guarantees

- Stable technical identifiers for works and source bundles explicitly supplied to the project.
- Validation of canonical IDs, duplicate IDs, non-empty titles and known source bundles.
- A catalogue that can later be consumed by world, work, reading-unit, progress and anti-spoiler layers.

## What it deliberately does not claim

The catalogue does **not** infer or encode:

- world assignments from a title;
- chronology or recommended reading order;
- chapter, page or location boundaries;
- plot events, characters or other narrative facts;
- summaries derived from inaccessible passages.

The private EPUBs remain source material outside this runtime module. Their protected text is neither copied nor stored here. Any future editorial metadata or original summary must be backed by an accessible source and added separately from the technical validation layer.

## Tests

`src/data/sourceCatalogue.test.ts` contains boundary checks for the verified catalogue and fail-closed handling of duplicate and malformed identifiers. The current project has no configured test runner in `package.json`, so these checks are intentionally framework-independent and are not represented as having been executed by this change.
