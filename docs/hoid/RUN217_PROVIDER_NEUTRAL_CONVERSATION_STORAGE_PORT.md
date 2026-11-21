# Run 217 — Provider-neutral conversation storage port

## Purpose

Run 216 introduced a pure, versioned and spoiler-aware conversation snapshot.
This run defines the storage boundary around that snapshot without choosing
SQLite, AsyncStorage, a cloud database, or an AI provider.

No concrete adapter is included and no application persistence is activated.

## Partition identity

Every operation requires two opaque identifiers supplied by the application
host:

- principalId: a stable, non-PII local/account partition key;
- conversationId: a stable identifier for one conversation.

The core does not derive either value from a display name, email address,
provider account, or device-global default. If the host cannot provide a
trusted principal partition, it must not persist or restore a conversation.

The storage envelope repeats both identifiers. A record returned under the
wrong principal or conversation key is rejected.

## Storage envelope

The storage record is separate from conversation snapshot schema v1. It has
exactly these fields:

- schemaVersion: 1;
- kind: hoid-conversation-storage-record;
- principalId;
- conversationId;
- storageRevision;
- snapshot: the canonical Run 216 v1 snapshot.

storageRevision is a monotonically increasing compare-and-swap generation.
It is distinct from the reading progress revision inside the snapshot.

## Port contract

HoidConversationHistoryStorePort exposes two asynchronous operations:

- read(key): returns null only when the exact partition is absent; otherwise
  returns an untrusted decoded value.
- compareAndSwap(key, expectedStorageRevision, nextRecord): atomically checks
  the current generation and replaces the entire record. A null expected
  revision means create-only. The result must be exactly saved or conflict.

The core rejects malformed port objects and never invokes accessor-backed
methods. Adapters must decode persisted bytes into plain data records before
returning them. They must not merge fields, silently downgrade schema versions,
or treat corrupt data as an absent record.

## Save protocol

The caller must refresh the authoritative reading progress immediately before
saving. The core rehydrates the supplied snapshot against that exact progress
identity and writes only when the result is ready.

The storage generation is advanced with compare-and-swap. A concurrent writer
returns conflict rather than overwriting a newer conversation. Storage
generation and reading progress revision are independent clocks.

## Load protocol

The adapter is queried with the exact principal/conversation partition. The
returned envelope must repeat those identifiers and pass strict validation.
The embedded Run 216 snapshot is then hydrated against the current reading
progress.

- Exact progress revision and fingerprint: return canonical conversation
  messages.
- Stale or unavailable progress: return user-authored messages and the exact
  static greeting only, with requiresRewrite=true.
- Malformed record, unknown version, wrong partition, or invalid snapshot:
  reject the record completely.
- Adapter error: return unavailable, never an empty-history fallback.

A stale load does not mutate storage. The host may explicitly save the safe
user-only subset using the returned storageRevision as its compare-and-swap
expectation. This prevents a cleanup read from racing with a newer write.

## Adapter requirements

Any future adapter must:

1. implement atomic compare-and-swap in a transaction or equivalent primitive;
2. scope reads and writes by both principalId and conversationId;
3. preserve storageRevision monotonically and reject stale writes;
4. store only the canonical snapshot returned by Run 216;
5. encrypt conversation content at rest where the platform provides an
   appropriate secure facility;
6. never log conversation text, provider payloads, or source material;
7. treat parse failures and unavailable storage as errors, not empty history;
8. avoid network/cloud synchronization unless a separately reviewed protocol
   adds authentication, conflict resolution, deletion and retention rules.

The current Atlas app has no authenticated multi-user principal. The adapter
therefore remains unconnected: no synthetic user identity or shared default
partition is introduced.

## Deliberate non-goals

- No SQLite or AsyncStorage implementation.
- No writes, schema migrations, or changes to reading progress.
- No automatic restore in HoidScreen.
- No provider-specific storage or transcript payload.
- No citations, segments, recommendation cards, or arbitrary metadata.
- No copying of EPUB, XHTML, passages, images, or protected narrative text.

Rich conversation content requires a separately reviewed snapshot schema with
per-segment evidence and progress authorization.
