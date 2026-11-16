# Progress Ledger: hostile-input hardening

## Threat boundary

The progress ledger receives values from two untrusted boundaries:

1. UI or application callers invoking `HoidProgressLedger.update()`.
2. Persistence adapters returning snapshots from `read()`.

TypeScript interfaces do not validate either boundary at runtime. A JavaScript adapter or caller can return accessors, symbols, sparse arrays, proxies, inherited properties, or values that violate the declared types.

## Canonicalization policy

The ledger now copies input into inert data before applying progress policy:

- Only plain objects with `Object.prototype` or a null prototype are accepted.
- Only explicitly allow-listed own string keys are accepted.
- Every accepted field must be an enumerable data property; getters and setters are rejected without invocation.
- Symbol keys, inherited fields, custom prototypes and unknown properties are rejected.
- Progress arrays must be dense, bounded arrays with no custom or symbol properties.
- Array indices are read through own property descriptors rather than normal property access.
- Proxy traps and revoked proxies are contained and treated as invalid data.
- Edition validation runs against the copied records, not against the original caller-owned objects.

A malformed update returns `rejected / invalid-update`. A malformed persisted snapshot returns `unavailable / corrupt-ledger` on read, or `rejected / corrupt-ledger` during update. No partial snapshot is salvaged.

## Why this matters to spoiler safety

The progress ledger is upstream of chapter authorization. A getter or proxy must not be able to execute while the ledger is deciding whether a work is complete or which chapter has been reached. Otherwise an untrusted value could mutate state during validation or throw out of the expected fail-closed path.

The ledger therefore treats canonicalization as a security boundary, not a convenience conversion. Only the resulting immutable snapshot may be passed to evidence authorization.

## Regression coverage

`progressLedger.test.ts` covers:

- update accessors are rejected without running the getter;
- hostile update proxies return a rejection rather than throwing;
- persisted snapshot accessors are rejected without running the getter;
- hostile snapshot proxies are contained;
- sparse arrays and arrays with symbol properties are rejected;
- revoked array proxies are contained;
- existing compare-and-swap and malformed-adapter cases remain covered.

## Non-goals

This change does not add durable storage, cross-device synchronization, new narrative facts, or EPUB extraction. The store remains an injected contract. A production adapter must still provide atomic compare-and-swap and must not claim persistence until the write is committed.
