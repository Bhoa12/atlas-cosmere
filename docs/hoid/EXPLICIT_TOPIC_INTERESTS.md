# Run 139 — explicit topic interests and spoiler-safe recommendations

## Scope

This run adds a user-selected topic-interest context and a provider-neutral recommendation gateway. It also corrects the Run 138 graph test to assert the graph's documented lexicographic node ordering.

## Explicit interest context

`topicInterestContext.ts` stores only:

- schema version;
- a closed set of selected topic IDs from the reviewed taxonomy;
- SQLite v2 progress revision;
- exact progress fingerprint.

It does not retain labels, free text, questions, reading history, claims, evidence prose, citations, source locators or provider output. Selection order is preserved because it is the reader's explicit priority order. The context is ephemeral and must be recreated after a progress change.

## Recommendation gateway

`topicInterestRecommendationsGateway.ts` validates the exact interest context against the supplied and live progress identities before producing any result. After an asynchronous local answer-port call, it revalidates both the caller-owned request snapshot and the live progress snapshot to reject mutation races. It reads only `HOID_APPROVED_TOPIC_ASSIGNMENTS`, selects claim IDs only for explicitly selected topics whose target works are still unstarted, and passes those IDs plus the current progress to an optional trusted local answer port.

The answer port is not a language-provider port. It must render only already-approved local claims through the existing evidence runtime. The gateway never passes topic labels, source prose, private EPUB content or prior conversation context to it. Returned answers are passed through `composeProductionHoidTopicRecommendations()`, which revalidates claim text, evidence IDs, source scopes, citations and per-work unlock boundaries.

If the production topic-assignment registry has no matching assignments, the gateway returns a neutral no-match result and does not call the answer port. If approved assignments exist but no local answer port is configured, it abstains rather than using an external provider.

## User interface

HoidScreen exposes the closed taxonomy as explicit selectable topics. It does not infer interests from questions, reading history, embeddings or model output. Recommendation results are displayed only while their progress revision and fingerprint match the live SQLite v2 snapshot. A progress change clears result text and citations while retaining the user's temporary selection; the next search creates a new progress-bound context. In-flight results are also bound to the exact selected-topic order, and topic chips are disabled while a recommendation request is pending.

## Production limitations

The source-controlled production topic-assignment registry is still empty. Therefore the UI can collect explicit interests, but it will currently report that no reviewed, spoiler-safe topic matches are available. Synthetic tests do not create production assignments. No private EPUB/XHTML body or protected passage is committed.


## Local approved-claim rendering

Run 140 adds `topicApprovedClaimAnswerPort.ts` and a selector-free `HoidEvidenceRuntime.renderApprovedClaimById()` path. The assignment registry selects exact approved claim IDs; the runtime returns only the corresponding local recommendation claim when every evidence item is verified, in context and unlocked in its own source work. The result includes one immutable claim segment and exact citations. No language selector or external provider is invoked.

HoidScreen injects this local port into the topic-interest gateway. The production assignment registry remains empty, so no topic recommendation is activated until an independently reviewed assignment and its approved claim/evidence records exist. See `LOCAL_APPROVED_CLAIM_RENDERING.md`.


## Run 141 — cursor-native local answer port

The public answer-port boundary receives the authoritative SQLite v2 cursor snapshot. It validates the snapshot with projectHoidCursorProgressSnapshot() and passes only the completed-through ReadingPosition[] projection to the evidence runtime. The original v2 snapshot is retained for final source-aware presentation and recommendation composition. This fixes the Run 140 shape mismatch without weakening chapter boundaries or adding a provider fallback. See LOCAL_APPROVED_CLAIM_RENDERING.md and CURSOR_NATIVE_RECOMMENDATION_ASSURANCE.md.
