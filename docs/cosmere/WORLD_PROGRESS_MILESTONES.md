# World progress milestones

`resolveWorldProgressMilestones` converts an already validated per-world
progress summary into one of three deliberately small states:

- `not-started`
- `started`
- `complete`

## Contract

The function accepts only metadata produced by the progress pipeline: a stable
world identifier, total/completed/pending unit counts and an exact completion
ratio. It validates the arithmetic again before producing output.

Any blocked upstream summary, duplicate world identifier, invalid count or
ratio mismatch blocks the complete result. The layer does not estimate or
repair progress.

## Editorial boundary

Milestones are technical UI metadata. This module does not contain book text,
chapter names, narrative order, summaries or canon facts. It therefore cannot
be used as evidence that a private EPUB was read or as an independent source
for editorial claims.

The same contract is reusable for Scadrial, Sel, Nalthis, Taldain, Roshar and
future worlds because it depends only on stable identifiers and validated
reading-unit metadata.
