# World progress availability

`resolveWorldProgressAvailability` converts already validated world progress
milestones into a small, deterministic availability model.

## Contract

- `not-started` maps to `available: false`.
- `started` and `complete` map to `available: true`.
- Duplicate, empty, unknown or malformed milestone records block the entire result.
- A blocked upstream result remains blocked.

## Scope

This is a technical metadata layer. It does not inspect private EPUBs, copy
protected text, infer reading order, identify spoilers, or make editorial claims.
It can therefore be reused for Scadrial, Sel, Nalthis, Taldain, Roshar and
future worlds without embedding narrative knowledge.
