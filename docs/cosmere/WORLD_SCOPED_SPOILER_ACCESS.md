# World-scoped spoiler access

This gate applies a validated world's reading frontier to a requested structural
position without carrying narrative text.

## Fail-closed rules

Access is blocked or locked when:

- the world identifiers are empty or do not match;
- the requested position is invalid;
- declared bounds contradict the frontier or request;
- a `blocked` frontier carries completed positions;
- a `complete` frontier is not explicitly bounded and equal to its declared
  length.

A `not-started` frontier never grants narrative access. The gate only
evaluates identifiers and numeric positions; catalog presence, EPUB access and
narrative verification remain separate concerns.

This contract is reusable for Scadrial, Sel, Nalthis, Taldain, Roshar and
future worlds because it does not encode editorial facts.
