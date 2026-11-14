# Context admission policy

`admitNarrativeContext` is the integration boundary between source provenance and
reader progress. A candidate must pass both checks before its original summary can
enter a provider context.

## Order of checks

1. **Provenance** rejects malformed metadata, inaccessible sources and summaries
   that are not explicitly marked as original.
2. **Reader progress** admits only chapters at or before the declared position in
   the same work.

The order is intentional: an item that fails provenance is never handed to the
chapter selector, preventing catalog metadata from being mistaken for accessible
narrative evidence.

## Fail-closed behavior

Unknown works, future chapters, empty summaries and protected or unknown summary
origins are rejected. Rejection records contain only an evidence identifier and a
technical reason; they do not preserve narrative text.

This module does not parse or store private EPUB text. The catalog can describe
which works exist, but catalog membership never grants narrative authority.
