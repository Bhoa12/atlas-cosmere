# World progress coverage

`summarizeWorldProgress` builds a world-level reading summary from the existing catalog-backed progress model.

For every declared world it reports only structural information:

- declared reading coordinates;
- completed coordinates that survived catalog validation;
- one pending declared coordinate, when available;
- duplicate work identifiers that make progress attribution ambiguous.

## Safety model

The summary does not inspect EPUB content or infer editorial structure. It delegates coordinate validation to `summarizeCatalogProgress` and therefore inherits its fail-closed handling of unknown works and undeclared positions.

A work identifier appearing more than once anywhere in the supplied catalog is considered ambiguous. Its coordinates and progress are excluded from world totals instead of being assigned to one world automatically. The conflicting identifier remains visible in `ambiguousWorkIds` so the metadata can be corrected upstream.

The `next` value is a technical catalog coordinate, not a claim about a chapter, narrative event, or recommended reading order. No gaps are filled and no source text is copied.

This allows Scadrial, Sel, Nalthis, Taldain and future worlds to share one progress architecture while verified reading structures are added incrementally.
