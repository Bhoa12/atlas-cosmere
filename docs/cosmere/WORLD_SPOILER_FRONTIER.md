# World spoiler frontier

`resolveWorldSpoilerFrontier` converts validated structural progress into a
minimal, reusable boundary for world-level anti-spoiler decisions.

## Output

The resolver returns one of:

- `blocked`: the structural input is missing, malformed or ambiguous.
- `not-started`: no declared reading position is complete.
- `in-progress`: only the completed position count is safe to use.
- `complete`: every declared position is complete.

The output deliberately contains no work titles, chapter text, narrative facts
or summaries. A caller that needs to reveal narrative content must still pass
the separate evidence-backed spoiler gate.

## Fail-closed rule

Ambiguous work associations, non-integer positions, empty sequences and progress
outside the declared range always produce `blocked`. This keeps the contract
usable for Scadrial, Sel, Nalthis, Taldain, Roshar and future worlds without
treating catalog metadata as editorial evidence.

This module does not read private EPUB text and does not assert that any source
or passage has been consulted.
