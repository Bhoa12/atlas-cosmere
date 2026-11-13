# Cosmere expansion boundary

This branch adds reusable metadata infrastructure without importing or reproducing protected EPUB text.

## Layers

1. **Sources** record provenance only.
2. **Works** reference a source.
3. **Worlds** are navigation records.
4. **World-work relations** must be explicit metadata; titles are never used to infer them.
5. **Reading units** are optional structural records and must not invent chapter boundaries.
6. **Progress and spoiler requirements** use stable unit IDs and fail closed.

## Provenance

`verified-index` means a title was supplied from a verified index. `declared-private` records a private source without claiming that its internal passages were inspected.

## Editorial boundary

This layer contains no copied passages, quotations, or unverified narrative claims. Future summaries must be original and backed by accessible sources. If a passage or structure is unavailable, it remains absent rather than inferred.
