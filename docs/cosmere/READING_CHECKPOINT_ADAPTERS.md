# Reading checkpoint adapters

These adapters connect declared reading progress with the checkpoint format used by composite spoiler gates.

They are intentionally conservative:

- only units explicitly declared for the same work contribute a checkpoint;
- unknown or cross-work unit identifiers are ignored;
- duplicate completed identifiers do not create duplicate checkpoints;
- catalog progress is accepted only for positive integer coordinates.

The adapters do not inspect EPUB text, infer chapters, repair missing metadata, or establish narrative dependencies. Catalog validation and spoiler-gate coverage validation remain responsible for deciding whether a declared coordinate is structurally valid.

This makes the bridge reusable across Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds while keeping progress mechanics separate from editorial content.
