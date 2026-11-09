# World Expansion Plan

`resolveWorldExpansionPlan` is a presentation-neutral planning boundary built on
already validated world-expansion queue entries.

## Contract

Each entry carries only explicit structural metadata:

- world identifier;
- numeric priority;
- readiness status;
- explicit eligibility.

A structure-ready world with `eligible: true` receives the technical action
`expand-structure`. Every non-ready world receives `await-structure`.

The plan does **not** inspect private EPUB text, infer works or worlds, create
reading units, verify narrative facts, or authorize spoilers. It is therefore
safe to reuse for Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds.

## Fail-closed behavior

The complete plan is blocked when identifiers or priorities are duplicated,
priorities are malformed, eligibility is not boolean, or eligibility contradicts
the structural readiness status. A blocked result must not be treated as a
partial plan.

Unknown future readiness labels remain pending rather than becoming eligible.
This keeps the boundary forward-compatible without granting structural or
editorial authority to unrecognized metadata.
