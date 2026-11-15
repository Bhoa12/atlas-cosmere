# Safe Response Boundary

`safeResponse.ts` is the final contract boundary for Hoid IA.

It accepts a candidate answer only when all of the following are already explicit:

- one non-empty book identifier;
- one positive integer chapter ceiling;
- non-empty original response text;
- at least one declared evidence identifier.

This layer does **not** retrieve EPUB content, call a model, or infer missing facts. It is intentionally provider-agnostic and works with identifiers rather than protected source text.

## Closed failure mode

Invalid scope or missing provenance returns the shared structured abstention contract. Callers must not replace that abstention with general model knowledge.

This boundary complements earlier authorization layers: they decide which evidence is allowed; this layer ensures the final narrative output cannot silently lose its scope or provenance.
