# Catalogue expansion boundary

This module is a reusable metadata boundary for expanding Atlas del Cosmere.

It represents sources, worlds, works and explicit work-world relations without storing protected EPUB text.

## Rules

- A world assignment is never inferred from a title, filename or narrative knowledge.
- A relation must reference existing work, world and source identifiers.
- Ambiguous or missing relations resolve to `null`.
- Reading units, progress and spoiler gates remain separate layers.

The verified private bibliography can populate work metadata only to the extent explicitly verified by its index. Declared private EPUBs do not imply that internal passages or structure were inspected.
