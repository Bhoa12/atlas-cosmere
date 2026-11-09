# Catalog expansion plan

`resolveCatalogExpansionPlan` converts catalog-derived readiness and explicit
world priorities into an ordered technical work plan.

## Inputs

- catalog readiness for each requested world;
- one explicit, non-negative integer priority per world.

The function requires an exact one-to-one correspondence between the two lists.
Duplicate world identifiers, duplicate numeric priorities, malformed statuses, or
missing priorities block the entire result.

## Actions

- `expand-structure`: the world is explicitly `ready` for the next structural phase.
- `await-catalog`: the world remains `cataloged` and has no authorization to advance.
- `blocked`: inconsistent metadata is retained as a non-actionable state.

A valid plan is ordered only by the supplied numeric priorities. The plan does not
infer editorial chronology, world membership, reading units, narrative facts, or
spoiler safety.

## Boundary

**source catalog → explicit world coverage → catalog readiness → ordered expansion plan → reading structure → progress → spoiler controls**

A planned action is a technical signal, not evidence that private source text was
read or that any narrative statement has been verified.
