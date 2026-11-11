# Source catalog runtime boundary

`sourceCatalogValidation.ts` validates the runtime shape of Atlas del Cosmere's
bibliographic source catalog.

## What it validates

The boundary checks only technical metadata:

- the catalog is an array;
- every entry has a canonical, non-empty ID and title;
- the source collection is one of the explicitly supported project inventories;
- `worldIds` is an array of canonical, non-duplicated IDs;
- `editorialStructureVerified` is an explicit boolean;
- work IDs are unique.

## Fail-closed behavior

Malformed metadata is rejected. The validator does not trim IDs, invent missing
world relationships, repair unknown source collections, or infer editorial
structure.

## Editorial boundary

Validation of a `worldId` is intentionally syntactic here. A valid-looking ID
does **not** establish that a work belongs to that world. Such relationships
must be introduced through separately verified metadata.

The module contains no book text, passages, chapter transcription, or plot
summary. It is safe to use with the project's private EPUB inventory because it
operates only on catalog metadata.
