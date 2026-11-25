# Run 306 — canonical progress-scoped history codec

## Purpose

Provide a deterministic, provider-neutral codec for the existing conversation
history v1 snapshot. The codec implements the encrypted Conversation Vault
codec port and can be reused by a future migration transfer adapter.

## Canonical format

- UTF-8 JSON with exact canonical key order.
- Snapshot schema remains `hoid-conversation-history` v1.
- Maximum encoded payload: 2,000,000 bytes.
- Maximum messages and text sizes remain governed by the existing history
  snapshot validator.
- SHA-256 digest is computed over the canonical JSON string encoded as UTF-8.
- Decode rejects malformed UTF-8, non-canonical JSON, duplicate keys,
  unsupported versions, sparse arrays, accessors, unknown fields and oversized
  payloads.

## Allow-list and privacy

The codec delegates validation to
`createHoidConversationHistorySnapshot` and
`hydrateHoidConversationHistorySnapshot`. It only accepts the current v1
text-only schema:

- user-authored messages;
- Hoid messages carrying the exact saved progress scope;
- the exact canonical static greeting;
- the saved progress identity.

It rejects citations, rich UI structures, tool traces, provider payloads,
EPUB paths, chapter locators and arbitrary extension fields. It does not read
or contain book source material. No EPUB body, XHTML, passage or extracted text
is committed by this run.

## Spoiler invariant

A successful codec round trip is not permission to display assistant prose.
The receiving bridge must hydrate the decoded snapshot against the live
progress scope. If the current book/chapter identity is absent or differs,
assistant answers are removed while user messages and the exact static
greeting may remain. The codec never decides that two progress scopes are
equivalent.

## Digest semantics

The digest is stable for the same canonical snapshot and changes when canonical
message content or progress identity changes. It is an integrity identifier
for migration verification, not an authenticity signature and not a substitute
for AEAD or a rollback-resistant authority anchor.

## Integration boundary

The factory returns the existing `HoidConversationVaultCodec` contract plus
`canonicalize` and `digest` helpers. It is not wired into production storage
or the migration runner in this run. No provider, native key store, AEAD
implementation, blob store or checkpoint is selected.

## Validation

The dedicated workflow runs the codec and history hydration tests, then strict
TypeScript checking over the codec and its dependencies. CI results must be
checked against the final branch HEAD.
