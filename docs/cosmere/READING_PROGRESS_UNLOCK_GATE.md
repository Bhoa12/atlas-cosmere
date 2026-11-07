# Reading-progress unlock gate

`canUnlockAtReadingUnit` is a structural anti-spoiler gate that connects an
already declared reading unit with validated reader progress.

## Contract

An item may unlock only when all of the following are true:

1. the required unit identifier is a non-empty string;
2. the reading-unit structure is valid and unambiguous;
3. completed units form the contiguous prefix required by
   `hasConsistentReadingUnitProgress`;
4. the required unit exists in that declared structure; and
5. the reader has completed that exact unit.

The implementation fails closed. Missing units, skipped progress, duplicate or
ambiguous structure, and malformed requirements all return `false`.

## Editorial boundary

This module does not create chapters or other reading units, read EPUB text, or
assert any narrative fact. A unit identifier only becomes useful here after its
structure has been independently declared and backed by the source/evidence
architecture. The gate therefore represents reader progress, not proof that a
book or passage has been editorially consulted.
