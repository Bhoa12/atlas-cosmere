# World catalog index

This layer connects stable work identifiers to stable world identifiers without storing prose, chapter text, plot summaries, or editorial claims.

## Contract

- Links must contain non-empty identifiers.
- Duplicate work/world pairs are rejected.
- An empty or malformed index is invalid.
- Queries return `null` when the index is invalid or the requested world has no declared links.

The index is intentionally **fail-closed**. A future trusted metadata pipeline may provide links for Scadrial, Sel, Nalthis, Taldain, Roshar, and other worlds, but this utility does not itself assert that any work belongs to a particular world. Bibliographic availability and narrative verification remain separate concerns.
