# Reading unit manifest runtime boundary

`resolveReadingUnitManifest` composes metadata-only reading units with independently validated world activation.

## Runtime contract

Activation and manifest collections are treated as untrusted at runtime. The resolver fails closed when:

- either collection is not an array;
- an activation entry is missing, has a non-canonical world identifier, or has invalid scalar metadata;
- a manifest identifier is empty or contains surrounding whitespace;
- an order is negative or outside the JavaScript safe-integer range;
- unit identifiers or per-world orders are duplicated.

The resolver does not trim, coerce, repair, or infer malformed metadata.

## Scope

This boundary handles only technical identifiers, activation state, source-catalog identifiers, and ordering coordinates. It does not read private EPUB text, reproduce protected passages, infer chapters or editorial sequence, or assert narrative facts.
