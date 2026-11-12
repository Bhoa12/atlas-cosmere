# World registry runtime boundary

The world registry provides stable technical identifiers for world namespaces used by
Atlas del Cosmere. Its initial registry exposes identifiers for Scadrial, Sel,
Nalthis, Taldain and Roshar so future data can use one reusable addressing layer.

## What this boundary guarantees

- A registered ID can be resolved deterministically.
- Collections reject malformed, duplicate and unknown IDs.
- Empty collections remain valid when no verified assignment is available.
- Validation is fail-closed and does not repair input.

## What this boundary does not claim

The registry does **not** establish that any catalogued work belongs to a particular
world. It also does not encode editorial structure, chronology, characters, events,
locations, summaries or reading order.

Work-to-world relationships must be added separately and only from verified project
metadata. Until then, catalog entries may intentionally keep an empty world list.

This separation keeps the reusable architecture ready for Scadrial, Sel, Nalthis,
Taldain, Roshar and future worlds without turning technical identifiers into
unverified editorial assertions.
