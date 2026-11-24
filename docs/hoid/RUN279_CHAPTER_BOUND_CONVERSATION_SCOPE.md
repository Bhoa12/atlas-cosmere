# Run 279 — Chapter-bound conversational scope

## Purpose

Run 278 introduced edition-bound, identity-only chapter references. Run 279 attaches those references to the existing ephemeral conversation-scope capability without changing the serializable scope-binding contract.

The objective is to preserve exact book/chapter identity across a follow-up while keeping three authorities separate:

1. Chapter identity: which numbered unit in which edition a citation refers to.
2. Reading progress: what the current cursor snapshot says the reader has completed.
3. Narrative authorization: which reviewed evidence the trusted presenter may disclose at the current progress boundary.

A chapter reference is not a reading cursor, a completion marker, an evidence grant, or a signature.

## Implementation

`src/hoid/conversationScopeBinding.ts` now derives an exact `HoidChapterReference` for every distinct citation in a successfully presented answer.

The references are held in a module-private `WeakMap` keyed by the already-issued `HoidConversationScopeBinding` object. They are deliberately absent from the binding's enumerable/serializable shape. This preserves the existing request contract and keeps the sidecar session-local.

Every call to `validateHoidConversationScopeBinding()` now:

- requires the original module-issued binding object;
- validates its current progress revision and fingerprint;
- retrieves the private chapter-reference sidecar;
- revalidates every reference against the current edition manifest;
- rejects ambiguous chapter labels while the current numeric cursor cannot represent their exact unit;
- checks that the sidecar's book/chapter set exactly matches the public work/chapter scope.

`getHoidConversationScopeChapterReferences()` exposes the validated metadata to trusted in-process callers. The references contain book ID, visible chapter number, ordinal, unit ID and a consistency fingerprint; they contain no EPUB locator, navigation hash, source text, evidence ID, claim ID or provider output.

## Fail-closed behavior

- If a citation cannot resolve to one exact edition-bound unit, no scope binding is created.
- If any reference is stale, ambiguous or inconsistent with the work/chapter list, the whole binding is rejected.
- If progress revision or fingerprint changes, the binding is stale.
- If the binding is cloned or serialized and restored, the WeakSet/WeakMap capability is lost and validation fails.
- No fallback widens the scope to automatic cross-book retrieval.

The current v1 cursor remains unable to authorize duplicated chapter labels. The four identity-only locators for the repeated labels in *Viento y verdad* remain structural references only; they are not admitted into this conversation sidecar or into reading progress. The numeric safe prefix remains unchanged.

## Provider and privacy boundary

The chapter-reference sidecar is local to the conversation-scope module. It is not added to `HoidEvidenceRuntime` requests, provider payloads, React message state, SQLite, the progress ledger, logs, or serialized conversation history.

The existing conversation gateway continues to pass only its canonical book scope and the already-authorized question/context identifiers through the runtime contract. A follow-up must still obtain a fresh answer and pass the trusted presentation/evidence checks. The sidecar only preserves and revalidates exact source identity; it does not authorize content.

## Tests

The conversation-scope suite now checks:

- exact chapter reference retention for a single-work answer;
- deterministic reference ordering for cross-work answers;
- absence of the sidecar, locator and identity fingerprint from serialized bindings;
- stale-progress invalidation;
- rejection of serialized/cloned bindings;
- existing hostile accessor, scope mismatch and locked-evidence behavior.

All fixtures are synthetic metadata and original test prose. No EPUB body, protected passage, chapter title or new narrative summary is included.

## Validation status

The dedicated workflow runs the conversation-scope, chapter-reference, chapter-identity and reading-manifest suites, followed by strict TypeScript checking. A successful local edit or a queued workflow is not considered certification; only completed checks on the final branch HEAD count.

## Isolation

- Base: `feat/hoid-ia-core-run278`, HEAD `18661ac872d289124703c26314e559e649c338b6`.
- New branch: `feat/hoid-ia-core-run279`.
- No changes to `main`, prior branches or existing pull requests.
- No automatic merge.
