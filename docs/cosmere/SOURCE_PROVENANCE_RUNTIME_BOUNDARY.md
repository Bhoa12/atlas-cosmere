# Source provenance runtime boundary

`sourceProvenanceBoundary` separates source metadata from editorial claims.

## States

- **verified-index**: the source's index or equivalent metadata has been
  explicitly verified.
- **declared-private**: the source is known to exist, but this runtime has not
  inspected the relevant passage or structure.
- **unavailable**: no claim may be derived from the source.

The boundary is deliberately conservative:

1. Invalid identifiers are rejected.
2. Unavailable sources fail closed.
3. Declared private sources may be catalogued but do not authorize a claim that
   their text has been inspected.
4. World membership, chronology, chapter boundaries and narrative facts remain
   outside this module.

This lets the Atlas retain the verified bibliography while preventing accidental
promotion of inaccessible material into asserted editorial content.
