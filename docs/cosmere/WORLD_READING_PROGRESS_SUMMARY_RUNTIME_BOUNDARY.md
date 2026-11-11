# World reading progress summary runtime boundary

`resolveWorldReadingProgressSummary(...)` is a technical aggregation boundary for
already-validated reading metadata. It derives counts and ratios only; it does not
infer reading completion, editorial order, chapters, or narrative facts.

## Runtime boundary

The manifest is treated as untrusted at runtime even when TypeScript types describe
it as `ReadingUnitManifestEntry[]`.

The resolver fails closed when:

- the manifest is not an array;
- an entry is missing or not an object;
- a world or unit identifier is empty or contains leading/trailing whitespace;
- a unit identifier is duplicated;
- validated progress does not partition exactly the known unit identifiers.

A blocked result exposes no world summaries. The layer never trims identifiers,
repairs malformed metadata, or invents missing units.

## Content boundary

This module works only with identifiers and progress states. It does not read,
copy, upload, or reproduce EPUB text, and it does not establish editorial facts.
