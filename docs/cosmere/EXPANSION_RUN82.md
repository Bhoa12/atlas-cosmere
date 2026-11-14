# Cosmere expansion — Run 82

This iteration adds a **bibliography manifest** that records only metadata explicitly supplied by the user.

## What is represented

- Priority world identifiers: Scadrial, Sel, Nalthis, Taldain and Roshar.
- The 17 titles in the verified index of `cosmere.epub`.
- Source provenance for each catalog record.

The manifest intentionally does **not** assign those works to worlds. A title alone is not treated as evidence for a world relationship.

## Editorial boundary

`verified-index` and `declared-private` sources can support catalog metadata, but cannot authorize an original narrative summary. Only a source explicitly marked both `editorial-accessible` and accessible can do so.

No EPUB passages, chapters or other protected text are stored here. The private Roshar EPUBs remain source declarations unless their relevant material is actually available to the environment.

## Tests

The accompanying synthetic test checks the verified title count, priority-world registry, bibliography integrity, metadata views and the distinction between catalog provenance and editorial provenance.
