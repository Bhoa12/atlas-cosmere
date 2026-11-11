# Reading-unit to catalog reference boundary

This boundary connects the generic reading-unit registry with the project's
verified bibliographic source catalog.

## What it validates

Each technical reading unit must:

- pass the existing runtime validation for unit IDs, work IDs, labels and
  positive technical positions;
- reference a work that is already present in the source catalog.

Malformed registries are blocked. A syntactically valid unit that references an
unknown work is also blocked.

## What it does not establish

A successful validation does **not** assert that a unit is a chapter, page,
official section, or any other editorial division. It also does not assign a
work to Scadrial, Sel, Nalthis, Taldain, Roshar, or another world, and it does
not infer chronology or narrative facts.

The boundary only confirms a technical identifier relationship. Editorial and
narrative metadata must remain separately verified before being exposed.

## Anti-spoiler integration

Consumers may use the validated unit IDs as progress prerequisites for the
generic anti-spoiler gate. This boundary does not decide what content is
spoiler-sensitive and never reads or reproduces protected EPUB text.

## Failure policy

The design is fail-closed: malformed units and unknown work references are not
repaired, normalized, or guessed.
