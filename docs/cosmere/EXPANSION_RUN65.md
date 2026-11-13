# EXPANSION RUN65

This iteration adds a provenance-aware content layer.

## Model

`ContentRecord` separates content state from bibliographic metadata. A record marked `metadata-only` cannot carry a narrative summary and is never revealed. This is intentional: a title or declared private source is not evidence for editorial facts.

Records marked `accessible` may contain an original summary only when the supporting material is actually accessible to the implementation workflow. Reading prerequisites are validated against units belonging to the same work.

## Anti-spoiler behavior

Evaluation is fail-closed. Content is blocked for missing progress, incomplete progress, invalid requirements, invalid records, or metadata-only provenance. Progress is normalized so unknown or cross-work unit IDs cannot unlock anything.

## Bibliography boundary

The verified index supplied for `cosmere.epub` is treated as title-level metadata only. Private Roshar EPUB declarations are catalog sources, not proof that passages or internal structure were inspected. No protected text is stored or copied.