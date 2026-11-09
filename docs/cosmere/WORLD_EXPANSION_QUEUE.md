# World expansion queue

`resolveWorldExpansionQueue` converts an explicit list of already-computed
world readiness states into an ordered implementation queue.

The priority order is supplied as metadata. The queue does not infer which
world should be expanded first, and it does not derive worlds or works from
titles, filenames, series names, or narrative knowledge.

## Eligibility

Only a readiness state of `structure-ready` is marked `eligible`. A
`cataloged` world remains present but pending. A `blocked` readiness state
is never converted into eligibility.

Eligibility is intentionally technical: it means the preceding structural
coverage layer reported verified reading structure. It does **not** mean that
private text was read, that narrative facts were verified, that a summary is
available, or that spoilers may be disclosed.

## Fail-closed behavior

The entire queue is blocked when:

- a readiness entry has no world identifier;
- a world appears more than once;
- a priority is empty, duplicated, negative, or non-integral;
- a readiness world is missing from the explicit priority list;
- a priority references a world without a readiness entry.

This makes expansion planning a metadata boundary rather than a source of
editorial inference. It can therefore prioritize Scadrial, Sel, Nalthis,
Taldain, Roshar, or future worlds using caller-provided identifiers without
encoding unsupported narrative claims.
