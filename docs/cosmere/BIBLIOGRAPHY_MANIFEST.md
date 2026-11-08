# Bibliography manifest

`resolveBibliographyManifest` provides a reusable bibliographic coverage check between three explicit registries:

1. a source catalog;
2. source-to-work bindings;
3. declared work identifiers.

The resolver never infers relationships from titles, filenames, chronology, world names, or external editorial knowledge.

## States

- **complete**: every declared work has at least one explicit binding to a cataloged source.
- **incomplete**: the registries are structurally valid, but one or more declared works have no binding.
- **blocked**: the catalog, bindings, or declared work registry is malformed or inconsistent.

This is a provenance check only. A complete result does **not** assert that a private EPUB was read, that narrative facts were extracted, or that any content is safe to reveal. Evidence and anti-spoiler authorization remain separate gates.

The catalog can therefore grow across Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds without embedding protected text or inventing editorial metadata.
