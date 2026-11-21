# Run 212 — SQLite revision-bound alias disclosure

## Finding

Run 211 added a per-alias host authority to the legacy provider routes, but its
contract only received a detached `ReadingPosition[]`. A port could check the
visible chapter projection, yet the contract did not prove which durable SQLite
revision was used for that check. It also did not require an authoritative
progress read when the question contained no catalogued alias, even though the
provider could introduce one in its answer.

## Changes

- Make the alias disclosure port asynchronous so a host adapter can load the
  latest validated v2 cursor snapshot from the durable progress store.
- Require an authorization result to carry both the exact grants and the
  `progressRevision` / `progressFingerprint` used to produce them.
- Invoke the host port for alias-free questions too, allowing it to capture the
  request's durable progress witness before the provider call.
- Re-run authorization after provider completion and require the exact same
  revision/fingerprint before rendering the answer.
- Reject duplicate work positions, lookalike catalog objects, malformed
  witnesses, partial grants, custom thenables, accessor-backed values and
  unavailable/throwing authorities.
- Add `createHoidProductionAliasDisclosurePort()`, which loads the latest
  `HoidCursorProgressStore` snapshot, validates its edition-bound projection,
  compares it with the request's completed-through positions, and resolves
  every alias against the source-controlled production resolver.
- Keep the production alias evidence registry empty. The adapter does not
  create, infer or approve alias records.

## Authorization sequence

1. The service validates and freezes the request's completed-through reading
   positions.
2. The host adapter loads the current SQLite cursor snapshot and validates its
   schema, revision and edition-bound cursors.
3. The adapter compares the durable snapshot's completed-through projection
   with the request reading positions.
4. Every matched alias is resolved independently against the reviewed
   knowledge and alias registries. A missing, ambiguous, locked or unreviewed
   alias blocks the complete request.
5. The adapter returns only exact `(entityId, alias)` grants plus the durable
   revision and progress fingerprint.
6. After the provider responds, the same process runs again. The answer is
   withheld if the progress revision or fingerprint changed.

The adapter deliberately performs a fresh store load on each authorization.
This catches changes made by another coordinator instance or another writer
sharing the same SQLite database, rather than trusting a stale in-memory cursor.

## Security invariants

- Entity first appearance never substitutes for alias-specific evidence.
- All aliases in a request are authorized with AND semantics.
- A known alias without a reviewed record is blocked.
- The AI provider never receives the disclosure port or its evidence registry.
- The question and answer must be authorized against the same durable progress
  revision and fingerprint.
- The adapter returns no source text, summary, evidence locator or unmentioned
  alias to the legacy provider route.
- Storage errors, migration errors, stale reading projections and malformed
  resolver results fail closed.
- The production alias registry remains empty until independent editorial
  inspection and review have taken place.

## Production integration status

The SQLite-backed adapter is implemented and tested, but it is not yet wired
into the application composition root. The host must inject it using the
application's `HoidCursorProgressStore` instance. Until that wiring is done,
legacy routes without an adapter continue to block known catalog aliases.

No progress rows, edition manifests, editorial claims, alias approvals, trust
keys or activation receipts are changed by this run.

## Privacy

No EPUB/XHTML source text, extracted passages, images or protected narrative
content is added. The adapter consumes only source-controlled metadata,
validated progress snapshots and reviewed editorial resolver results.
