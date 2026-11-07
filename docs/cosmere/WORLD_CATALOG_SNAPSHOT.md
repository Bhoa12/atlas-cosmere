# World Catalog Snapshot

## Purpose

`resolveWorldCatalogSnapshot` is a bibliographic projection for one declared world. It connects an already-declared work-to-world index with source-catalog metadata.

## Safety contract

The snapshot is **not editorial evidence**. A result of `cataloged` only means that the supplied structural inputs are internally valid and that every linked work has a source-catalog record.

The `sourceAccess` field is preserved so consumers can distinguish `cataloged` from `verified-structure`. Neither state authorizes narrative claims, chapter inference, quotations, or spoiler unlocks by itself.

## Fail-closed behavior

The result is `blocked` and exposes no work list when:

- the world identifier is invalid;
- the world has no declared work links;
- the link index is invalid or ambiguous;
- the source catalog is invalid; or
- any linked work lacks a unique source record.

## Editorial boundary

Private EPUB availability is represented only through catalog metadata unless structure or editorial evidence has been separately verified. This module stores no EPUB text and does not claim that any passage was read.
