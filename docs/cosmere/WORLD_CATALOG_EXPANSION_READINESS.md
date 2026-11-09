# World catalog expansion readiness

`resolveWorldCatalogExpansionReadiness` derives a conservative technical readiness
signal from an already-declared source catalog and explicit work-to-world assignments.

## States

- `ready`: at least one catalog entry explicitly covers the requested world.
- `cataloged`: the request is valid but no explicit assignment covers that world.
- `blocked`: catalog or coverage metadata is inconsistent; no world is treated as ready.

This layer never reads private source text, infers world membership, creates reading
units, or verifies narrative facts. A `ready` result means only that declared
metadata is sufficient to proceed to the next structural phase.

The intended boundary is:

**source catalog → explicit world coverage → expansion readiness → reading structure → progress → spoiler controls**
