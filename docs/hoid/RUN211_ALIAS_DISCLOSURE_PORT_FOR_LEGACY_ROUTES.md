# Run 211 — Per-alias disclosure for legacy provider routes

## Finding

The current production conversation route has a dedicated entity resolver and a
reviewed alias-evidence registry. The older HoidService and HoidPipeline routes,
however, only checked the entity-level first-safe appearance through
HoidKnowledgeCatalog.lockedMatches().

An entity's first appearance does not prove that every later spelling,
epithet, identity or alternate name is safe to disclose. The repository already
models this distinction in HoidEntityAliasEvidence, but the legacy provider
boundaries did not require that authority.

A known alias could therefore pass the legacy route after the entity's first
appearance even when the alias itself had no reviewed disclosure record.

## Changes

- Add a provider-neutral HoidAliasDisclosurePort contract.
- Add authorizeHoidCatalogAliasMentions() to match every catalogued spelling
  and require an exact host grant for every matched (entity ID, alias) pair.
- Require the port in HoidService and HoidPipeline whenever a known alias is
  present in the question.
- Re-run the same authorization against provider output; a question grant is
  never reused to authorize a different spelling returned by the provider.
- Keep text with no catalogued aliases independent of the alias registry.
- Reject missing, malformed, stale, partial, extra, duplicate, accessor-backed,
  throwing or asynchronous grants.
- Snapshot reading positions and the minimal matched-alias projection before
  invoking the host authority.
- Expose no summary, evidence, first-safe chapter or unmentioned alias through
  the authorization request.
- Extend the public service facade with optional host-owned port injection.
- Add focused tests for exact grants, missing authority, partial grants,
  provider-output disclosure, immutable requests and hostile descriptors.

## Contract

The port is injected by the trusted application host. It is not a model tool,
provider callback or user-controlled request field.

For every matched catalog entity, the host must verify every alias included in
the request against independently reviewed alias evidence. The returned grant
must echo the exact entity IDs and exact matched aliases. A correct production
adapter should use the source-controlled alias registry and the same canonical
progress snapshot used by the answer route.

The production alias registry remains empty until individual spellings have
been inspected, scoped and reviewed. Therefore a correct production adapter
must continue to withhold known aliases until evidence exists.

## Security invariants

- Entity first-safe appearance and alias disclosure are independent gates.
- Missing alias authority blocks a known catalogued spelling.
- Every alias in a multi-alias question must be authorized (AND semantics).
- Provider output is rechecked independently.
- The provider cannot construct, replace or widen the alias authority.
- Unknown text with no catalogued alias does not require an alias grant.
- Malformed or unavailable authorization never falls back to entity-level
  first appearance.
- No EPUB text, XHTML, extracted passage or protected narrative content is
  included in this change.

## Validation

The dedicated workflow runs the alias boundary, both legacy provider routes,
the existing HoidService catalog boundary tests, and strict TypeScript checks.

## Scope and production status

This change hardens compatibility/legacy routes. It does not activate the
HoidScreen trusted answer presenter, populate the alias registry, create review
records, provision trust keys, alter reading progress, modify edition
manifests, or promote editorial claims.

The application must inject a host-owned implementation before any legacy
route can answer a question containing a catalogued alias. With no port, that
route deliberately fails closed for known aliases.
