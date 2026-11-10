# World progress availability

`resolveWorldProgressAvailability` converts already validated world progress
milestones into a small, deterministic availability model.

## Contract

- `not-started` maps to `available: false`.
- `started` and `complete` map to `available: true`.
- World identifiers are canonical metadata: empty or whitespace-padded values
  are rejected instead of being silently normalized.
- Duplicate, unknown or malformed milestone records block the entire result.
- A blocked upstream result remains blocked.

Rejecting padded identifiers prevents two source records that merely look similar
after normalization from being merged accidentally by downstream progress or
spoiler layers.

## Scope

This is a technical metadata layer. It does not inspect private EPUBs, copy
protected text, infer reading order, identify spoilers, or make editorial claims.
It can therefore be reused for Scadrial, Sel, Nalthis, Taldain, Roshar and
future worlds without embedding narrative knowledge.
