# Run 241 — explicit answer-scope integration in HoidScreen

## Objective

Expose the Run 240 book-scoped evidence contract in the real Hoid screen without allowing a UI selection to grant narrative access.

## User-facing modes

- **Automatic:** no explicit scope is sent; existing per-work progress authorization remains authoritative.
- **Single work:** exactly one known bibliography ID is required.
- **Cross-work:** two to four distinct known bibliography IDs are required.

The screen lists the metadata-only bibliography. Selection is temporary React state and is never written to SQLite, conversation storage or provider preferences.

## Selection semantics

- Single-work selection replaces the previous work; tapping the selected work clears it.
- Cross-work selection toggles membership and is capped at four works.
- Invalid, duplicate, unknown or incomplete selections cannot reach the narrative runtime.
- Changing scope clears typed and untyped follow-up context and resets the visible conversation to the static greeting. This prevents a pronoun or follow-up from inheriting a previous scope.
- Scope selection is not applied to reading-progress or catalogue-recommendation intents; those retain their own contracts.

## Gateway propagation

HoidConversationGateway accepts only a closed canonical HoidAnswerBookScope. It validates the scope before coreference/entity routing and forwards the canonical object through:

- typed entity follow-up;
- scoped group follow-up;
- single-entity coreference;
- ordinary narrative answer selection.

For an explicitly scoped relationship question, the gateway bypasses the unscoped relationship-graph shortcut and delegates to the strict evidence runtime with the resolved entity IDs. This ensures the book-scope filter and each book's chapter unlock are applied to the final claim set. Without an explicit scope, the existing locally reviewed relationship route is unchanged.

The cursor-native facade already forwards bookScope to HoidEvidenceRuntime. The runtime remains responsible for:
- verifying each work independently against the reader's progress;
- filtering all claim evidence to the requested scope;
- requiring evidence in every work for cross-work answers;
- abstaining before provider invocation if any requested work lacks authorized evidence;
- rendering only local, reviewed claim text and citations.

## Conversation and freshness safety

Scope changes reset local conversational context. The existing progress revision/fingerprint checks still run before and after asynchronous work. Scope is not an authorization token, a progress identity, or a durable preference.

## Tests

- Pure selection reducer tests cover automatic, single-work and cross-work cardinality, unknown/duplicate IDs, four-work cap, immutability and deterministic identity.
- Conversation gateway tests verify canonical scope forwarding, invalid-scope rejection before runtime invocation, and scoped group follow-up routing through the strict evidence runtime rather than the unscoped relationship graph.
- Existing evidence-runtime and cursor-facade suites continue to test per-work unlock and provider preflight.

## Privacy and source integrity

This run changes no editorial source data. No EPUB, XHTML, extracted prose, private path, source locator or narrative summary is added. The 24-work bibliography remains metadata-only. No new chapter is claimed as inspected and no production claim is promoted.
