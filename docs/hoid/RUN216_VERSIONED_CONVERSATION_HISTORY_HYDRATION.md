# Run 216 — Versioned conversation history hydration boundary

## Purpose

HoidScreen currently keeps conversation messages in component memory. This run
introduces a pure, versioned validation boundary for a future persistence or
restore adapter. It does not add storage, write to SQLite, or claim that durable
chat history exists.

## Schema v1

The accepted envelope has exactly four own data properties:

- \`schemaVersion: 1\`
- \`kind: "hoid-conversation-history"\`
- \`progressScope\`: the exact saved progress revision and SHA-256 fingerprint
- \`messages\`: a dense, bounded array of canonical text-only records

Message variants are intentionally narrow:

- User: \`id\`, \`emisor\`, \`texto\`
- Hoid answer: \`id\`, \`emisor\`, \`texto\`, \`progressScope\`
- Static greeting: the exact application-owned ID, role, kind and text

Every assistant answer in one v1 snapshot must match the envelope's saved
progress scope. IDs must be unique. Duplicate greetings, sparse arrays,
accessors, inherited objects, extra keys, malformed scopes and oversized
payloads invalidate the complete snapshot.

## Hydration behavior

- Exact current progress revision and fingerprint: restore canonical user,
  greeting and assistant text records.
- Stale or unavailable current progress: retain only user-authored messages
  and the exact static greeting; omit all assistant prose.
- Invalid envelope or any malformed message: reject the complete snapshot.
- Unknown schema version: reject; there is no permissive legacy fallback.

The parser returns fresh frozen records and never executes getters.

## Deliberate v1 limitation

Version 1 is text-only. Citations, segment provenance, narrative layout,
recommendation cards, provider payloads and arbitrary metadata are rejected,
not silently stripped. Supporting those fields requires a separately reviewed
schema version with its own canonical validators and progress binding.

This avoids pretending that a future persistence adapter can safely serialize
the current rich in-memory \`HoidScreen\` messages without additional contracts.

## Integration status

The module exposes pure create/validate and hydrate functions. No storage
adapter calls them yet. A future adapter must:

1. serialize only the returned canonical snapshot;
2. hydrate through this validator before rendering;
3. never fall back to legacy unscoped assistant prose;
4. treat stale progress as user-history-only;
5. keep writes and migrations outside this module.

## Privacy

No EPUB bytes, XHTML, passages, narrative summaries, aliases, source locators,
or production approvals are added. The schema stores only conversation text,
message identity and progress revision/fingerprint. It does not read or mutate
reading progress.
