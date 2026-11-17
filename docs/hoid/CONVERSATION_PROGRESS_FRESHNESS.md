# Conversation progress freshness boundary

## Purpose

The strict evidence runtime authorizes claims against a validated v2 reading snapshot. A response or recommendation can become stale while an asynchronous operation is pending: the reader may advance, reopen a completed work, or otherwise change the authoritative snapshot before the UI renders the result.

HoidConversationGateway applies the same progress-freshness boundary to narrative answers and metadata-only catalogue recommendations.

## Answer lifecycle

1. Validate the request as a plain data record with exactly question and progress.
2. Validate the supplied v2 snapshot and calculate its canonical progress fingerprint.
3. Read the coordinator's latest in-memory authoritative snapshot through the injected getter.
4. Reject before invoking the runtime if the request snapshot is already stale.
5. Invoke only the strict HoidCursorEvidenceRuntime.answer().
6. Read and validate the coordinator snapshot again after the asynchronous answer completes.
7. Return the answer only if both revision and fingerprint still match. Otherwise discard the answer, text and citations together.

## Recommendation lifecycle

1. Validate a plain request containing only progress and an optional bounded limit.
2. Validate the v2 snapshot and derive the started-work set from its edition-bound positions. A cursor on chapter one counts as started even though it authorizes no completed chapter.
3. Compare the request snapshot with the coordinator's live snapshot before invoking the recommender.
4. Invoke only the runtime's metadata-only recommend capability. It does not call a model or read narrative text.
5. Validate every returned item against the fixed bibliography: exact source ID, exact catalogue title, the closed unread-source reason, uniqueness and exclusion of all started works.
6. Re-read the coordinator snapshot after the asynchronous operation. If revision or fingerprint changed, discard the complete recommendation list.
7. Return only catalogue metadata plus the progress revision and fingerprint.

Recommendations intentionally mean works in the supplied catalogue that have not been started. They do not imply a canonical reading order, a narrative dependency, or an editorially recommended sequence.

## UI composition

CosmereContext.getHoidCursorProgressSnapshot() reads the coordinator's current snapshot rather than relying only on the last React state projection. Once a coordinator exists, a null coordinator snapshot is authoritative and must not fall back to an older React snapshot.

HoidScreen uses that getter for both request snapshots and the gateway's before/after checks. Recommendation results are associated with the revision that authorized them and are hidden when the current revision differs.

A progress-changed result is rendered as a neutral retry message. Stale answers and stale recommendation lists are not retained for display.

## Failure behavior

The gateway fails closed when:

- the request has extra keys, accessors, malformed text or no valid snapshot;
- the current coordinator snapshot cannot be read or validated;
- the current revision or canonical fingerprint differs before invocation;
- the runtime throws or does not expose recommendation capability;
- a recommendation contains an unknown ID, a mismatched title, a duplicate, a started work, an unsupported reason or an oversized batch;
- the progress changes while the asynchronous operation is pending.

Unavailable results contain only a reason code. They do not include stale answer text, claim IDs, citations or rejected recommendation titles.

## Concurrency limitation

This is a stale-result suppression boundary, not cancellation. If progress changes after the strict runtime has already begun an operation, that operation may finish using the previously validated state. The gateway discards its result and prevents it from reaching the UI. Cancellation can reduce unnecessary work later, but must never replace the post-completion fingerprint check.

## Source and privacy policy

The gateway accepts only the local v2 progress snapshot and the strict runtime. Recommendations use the metadata-only bibliography. They do not read EPUB files, store source passages, or transmit private book content. Editorial registries remain source-controlled and empty until original claims have been reviewed.

## Verification

conversationGateway.test.ts covers unchanged progress, stale snapshots before invocation, changes during an in-flight answer or recommendation, revision reuse with changed positions, malformed/accessor requests, invalid snapshots, runtime failures, control-character input, and rejection of untrusted recommendation metadata.

The knowledge-graph workflow runs this suite and strict TypeScript checking for the gateway. The cursor-native Atlas workflow type-checks CosmereContext and HoidScreen. Device-level Android/iOS interaction and rapid progress-change testing remain release checks.
