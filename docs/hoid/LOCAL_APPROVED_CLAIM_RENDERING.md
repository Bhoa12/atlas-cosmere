# Run 140 — local approved-claim rendering for topic recommendations

## Purpose

Run 139 introduced explicit topic interests and a provider-neutral recommendation gateway, but its optional local answer port was not wired into HoidScreen. Once reviewed topic assignments exist, the UI would therefore abstain with `answers-unavailable`.

This run supplies a local, selector-free renderer. The approved assignment registry chooses claim IDs; the evidence runtime renders only the exact approved editorial claim associated with each ID.

## Runtime contract

`HoidEvidenceRuntime.renderApprovedClaimById(claimId, reading)`:

- accepts one canonical claim ID and a validated edition-bound reading snapshot;
- accepts only claims whose intent is `recommend`;
- requires every evidence ID to resolve to a known knowledge entry;
- requires every entry to be verified and eligible for context;
- requires every first-safe-appearance and evidence-unlock threshold to be reached in its own work;
- reconstructs exact evidence citations from the local knowledge registry;
- returns one immutable segment containing the exact local claim text and its evidence IDs;
- never invokes `HoidClaimSelector` or any language provider.

Unknown, malformed, non-recommendation, or locked claims abstain or are rejected. There is no partial rendering of a multi-evidence claim.

## Answer port

`topicApprovedClaimAnswerPort.ts` adapts a local `HoidEvidenceRuntime` to the recommendation gateway's `answerApprovedClaims` port.

The adapter accepts only a dense, unique, bounded list of canonical claim IDs. It returns records shaped as `{ claimId, answer }` only when the runtime returns exactly one authorized segment for that same ID.

The adapter receives no topic labels, free-text questions, prior conversation context, EPUB bodies, or provider output. It has no network or provider dependency.

## UI wiring

`HoidScreen` creates the local answer port from the same editorial runtime used by the strict conversation path and injects it into `createHoidTopicInterestRecommendationGateway`.

The production topic assignment registry remains empty. Consequently the gateway still returns a neutral no-match result and does not invoke the port today. When assignments are added through the protected editorial workflow, the local port is already available; it will not activate any assignment by itself.

## Regression correction

The gateway distinguishes a missing context from a malformed context:

- absent or `null` context → `context-missing`;
- present but malformed context → `context-invalid`.

The Run 139 test expectation is updated to match this contract and now tests both cases separately.

## Validation

The explicit-topic workflow runs:

- topic-interest context and gateway tests;
- local approved-claim answer-port tests;
- strict evidence-runtime tests;
- topic recommendation and taxonomy tests;
- deterministic knowledge-graph tests;
- strict TypeScript checks including the local port, evidence runtime and `HoidScreen.tsx`.

All fixtures are synthetic original editorial statements. No private EPUB/XHTML body, protected passage, or reading-progress mutation is included.
