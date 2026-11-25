# Hoid IA — Run 316: source catalogue identity manifest

## Purpose

Run 316 adds a deterministic, metadata-only identity snapshot for the exact
24-work bibliography supplied for Hoid IA. It prevents accidental omission,
renaming or reassignment of a source work from going unnoticed during later
editorial and coverage changes.

## Catalogue contract

The manifest contains only:

- internal work ID;
- user-facing work title;
- source group (cosmere.epub or roshar-epubs);
- total and per-group counts;
- a SHA-256 fingerprint over the ordered identity tuples.

The expected inventory is 17 entries from cosmere.epub and seven Roshar
entries. The exact identities are pinned in the source-catalogue tests.

## Fingerprint semantics

The fingerprint is SHA-256 over UTF-8 JSON with this canonical shape:

    {"schemaVersion":1,"works":[["id","title","sourceGroup"], ...]}

The tuples preserve bibliography order. The fingerprint changes if an ID,
title, source group, or ordering changes.

Current fingerprint:

    4cc935583679307826664e2555f2df6ae55d8784b758c6aaf35afbc05e43b01b

This digest identifies catalogue metadata only. It is not a signature, trust
root, source-file digest, edition digest, chapter-document digest, or proof
that a private EPUB is present in the current runtime.

## Availability and copyright boundary

The manifest explicitly reports:

- scope: metadata-only;
- sourceContentIncluded: false;
- accessStatus: not-asserted.

A bibliography entry does not imply that its EPUB bytes are currently mounted,
that a chapter was inspected, or that a narrative summary is supported.
Existing edition manifests, inspected-document allowlists and editorial
staging remain separate evidence layers. Uninspected passages must remain
unavailable; no chapter facts are inferred from the catalogue.

No EPUB, XHTML, chapter title, copied passage, extracted source text, image,
or private file path is added by this run.

## Authorization boundary

The manifest is descriptive only. It does not authorize:

- a reading cursor or completed chapter;
- entity-name disclosure;
- summary disclosure;
- cross-book chronology;
- recommendation eligibility;
- editorial approval or production promotion.

The existing evidence runtime, edition-bound locators, inspected document
digests, progress watermarks, reviewer signatures and promotion authorities
remain the only relevant authorization boundaries.

## Validation

The source-coverage workflow now runs the catalogue-manifest tests and strict
TypeScript checks. The coverage report exposes the same fingerprint together
with the explicit non-assertion of source availability.
