# Run 213 — Production alias resolver non-injectability

## Finding

Run 212 introduced a SQLite-backed alias disclosure adapter, but its public
options still exposed an optional `resolveEntity` callback described as a
test seam. The production factory preferred that callback whenever supplied.

That meant an application composition error, a JavaScript caller, or an
untrusted integration could replace the source-controlled entity resolver
with a function that returned fabricated `matched` results. The adapter did
check the returned entity ID, spelling and progress witness, but the injected
resolver could omit the actual reviewed alias evidence.

A test-only seam inside a production constructor is still a production
capability. The boundary now removes it.

## Changes

- Remove `resolveEntity` from `HoidProductionAliasDisclosurePortOptions`.
- Bind `createHoidProductionAliasDisclosurePort()` directly to
  `resolveProductionHoidEntities`; callers can supply only the durable
  progress store.
- Canonicalize the options record and reject unknown keys, including a
  runtime-supplied `resolveEntity` property.
- Resolve the store's `load` method from a data-property descriptor without
  invoking getters. Accessor-backed methods and malformed store objects fail
  closed.
- Validate the complete production resolver result: exact match shape,
  canonical knowledge kind, entity source metadata, non-empty alias evidence,
  evidence identifiers, edition metadata, and SHA-256 fingerprints.
- Replace callback injection in tests with module-level mocking of the
  source-controlled resolver. This keeps synthetic fixtures out of the public
  production API.
- Add regression tests for resolver override attempts, getter execution,
  incomplete provenance and alias-evidence records.

## Security invariants

1. Production callers cannot choose which entity resolver authorizes a name.
2. A successful match must come from the source-controlled production
   knowledge and alias registries.
3. A resolver result is not accepted unless it contains a canonical entity
   source and at least one canonical alias-evidence source.
4. The durable SQLite revision and fingerprint must still match the request.
5. Every alias in a request is independently resolved; any missing, ambiguous,
   locked or malformed alias blocks the complete operation.
6. Store and resolver failures remain fail-closed.
7. The AI provider never receives the resolver, progress store, alias registry,
   source evidence or unmentioned aliases.

## Test coverage

The production adapter tests now cover:

- Successful exact resolution with complete provenance.
- Reading projection mismatch.
- Alias with no independently approved record.
- Wrong progress revision.
- Unavailable SQLite storage.
- Witness capture for alias-free requests.
- AND semantics for multiple aliases.
- Revision changes between calls with the same visible chapter.
- Rejection of a caller-supplied resolver override.
- Rejection of accessor-backed store methods without invoking the getter.
- Rejection of matched results with incomplete entity or alias evidence.

Tests mock the imported source-controlled resolver at the module boundary.
No production constructor accepts an arbitrary resolver callback.

## Production status

The production alias evidence registry remains empty until independently
reviewed evidence is available. This change does not create or approve any
alias, does not activate narrative answers, and does not wire the adapter into
the application composition root.

## Privacy

No EPUB/XHTML text, extracted passages, images or protected narrative content
is added. Only code, contracts, tests and documentation are changed.
