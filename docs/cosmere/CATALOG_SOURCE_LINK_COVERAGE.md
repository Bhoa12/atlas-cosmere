# Catalog source-link coverage

`summarizeCatalogSourceLinkCoverage` reports whether catalog works have a
unique structural link to a declared bibliographic source.

It is deliberately provenance-only. A linked work is **not** evidence that its
EPUB was opened, parsed, or used to verify any chapter, narrative fact, world
assignment, chronology, or spoiler checkpoint.

## Fail-closed behavior

- A missing source is reported and does not cover the work.
- A duplicated source identifier is ambiguous and does not cover the work.
- Links for unknown works are ignored for coverage and cannot create catalog
  entries.
- Unlinked works remain explicit so metadata expansion cannot silently assume
  source coverage.

This layer stores no protected text and does not create editorial content.
