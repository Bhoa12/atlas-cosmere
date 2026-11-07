# World-scoped spoiler access

`resolveWorldScopedSpoilerAccess` is a small, reusable fail-closed gate for
applying a validated world reading frontier to one requested position.

## Inputs

The caller provides only:

- a stable world identifier;
- the world identifier attached to the requested content;
- the required reading position;
- a previously validated frontier status;
- the number of positions safely completed.

The gate intentionally does not receive titles, chapter text, quotations,
summaries, or inferred narrative facts.

## Outcomes

- `blocked`: malformed input, a cross-world request, or a blocked frontier;
- `locked`: the requested position is ahead of the safe frontier;
- `allowed`: the requested position is at or behind the safe frontier.

This contract is suitable for Scadrial, Sel, Nalthis, Taldain, Roshar and future
worlds because it is independent of editorial content. An `allowed` result
only answers a structural access question; narrative content must still satisfy
the separate evidence-backed content gate.
