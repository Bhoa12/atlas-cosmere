# Run 299 — Encrypted conversation history bridge

## Goal

Connect the revisioned encrypted conversation vault to the existing versioned,
progress-scoped conversation-history schema without introducing a second history
format or exposing restored assistant prose before progress revalidation.

## Components

- `conversationVaultHistoryCodec.ts` implements the vault byte codec using the
  existing `fflate` UTF-8 helpers. It accepts only the exact v1 history envelope
  validated by `createHoidConversationHistorySnapshot`.
- `conversationVaultHistoryBridge.ts` binds one vault session to the existing
  history policy. Save accepts messages and a progress scope, not an arbitrary
  provider snapshot. Restore immediately calls
  `hydrateHoidConversationHistorySnapshot` with the caller's live progress scope.
- The v1 schema continues to persist only bounded text messages and the
  progress identity required to invalidate stale assistant answers.

## Security properties

- Unknown envelope keys and unknown message keys are rejected.
- Provider payloads, citations, evidence locators, presentation permits,
  authorization tokens, trust checkpoints, and raw EPUB references cannot be
  serialized through this bridge.
- Assistant messages must carry the exact saved progress scope.
- A restored assistant answer is returned only when the live progress scope
  matches exactly. If progress is unavailable or has changed, only user-authored
  messages and the fixed static greeting survive hydration.
- Malformed snapshots block restoration; there is no partial assistant fallback.
- UTF-8 decoding is checked by re-encoding and comparing the original bytes.
- The bridge does not implement encryption, key management, storage, or
  anti-rollback. Those remain the responsibility of the vault's native ports.

## Provider independence

The codec and bridge depend only on Hoid contracts and the existing history
policy. They do not import an LLM SDK, provider-specific message type, network
client, or native key implementation.

## Source and copyright boundary

This change does not read, copy, upload, index, or summarize EPUB chapter bodies.
It only persists user-authored chat text and Hoid response text that has already
passed the existing progress-scoped presentation policy. The private EPUB
catalog and exact-edition evidence system remain separate.

## Validation

The dedicated workflow runs:
- vault-history bridge tests;
- existing conversation-history hydration tests;
- existing encrypted-vault tests;
- strict TypeScript checking for the bridge, codec and tests.

## Production limitations

This is a persistence integration boundary, not a production native security
claim. Android Keystore, iOS Keychain, a vetted native AES-GCM implementation,
and a rollback-resistant checkpoint still must be supplied and independently
validated before enabling durable conversation storage in the app.
