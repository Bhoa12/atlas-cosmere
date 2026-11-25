# Run 300 — strict vault bridge result validation

## Goal

Harden the adapter boundary between the encrypted conversation vault and the
progress-scoped history bridge. TypeScript interfaces do not validate values
returned by runtime adapters; every result is now treated as untrusted data.

## Changes

- Validate exact own data fields for every vault result variant (empty, ready,
  saved, cleared, conflict, and blocked).
- Reject getters, symbols, unexpected properties, unknown statuses, unknown
  blocked reasons, malformed revisions, and non-plain result objects without
  invoking accessors.
- Require ready revisions to be positive and empty revisions to be
  non-negative. Positive empty revisions remain valid because a verified
  tombstone represents an empty conversation at a later durable revision.
- Require successful save and clear operations to advance exactly one
  revision from the caller's expected revision.
- Validate expected revisions before calling the adapter; invalid values never
  reach the vault.
- Normalize every accepted result into a fresh frozen data object. Malformed
  adapter output becomes blocked/invalid-vault-result and cannot release
  restored assistant prose or poison a later compare-and-swap revision.

## Security properties

The bridge still rehydrates every restored snapshot against the live progress
scope before returning messages. This change adds validation of the storage
protocol metadata around that snapshot. It does not change the canonical v1
history schema, progress identity, encryption algorithm, key management,
checkpoint implementation, or provider boundary.

No dual-write is introduced. The SQLite history store remains separate and
must not write the same conversation partition as the vault. No production
storage activation is implied.

## Tests

The bridge suite adds cases for positive-revision tombstones, malformed and
accessor-backed results, unexpected fields and reasons, invalid caller
revisions, and non-monotonic save/clear success responses.

## Source and copyright boundary

Only synthetic conversation fixtures are used. No EPUB body, XHTML, protected
passage, private file path, or narrative summary is read or committed.
