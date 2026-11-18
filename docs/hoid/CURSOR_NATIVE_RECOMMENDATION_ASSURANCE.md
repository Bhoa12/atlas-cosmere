# Run 141 — cursor-native recommendation assurance

## Purpose

Run 140 connected the local approved-claim renderer to the explicit-topic recommendation gateway. The gateway's public contract supplies the authoritative SQLite v2 cursor snapshot, while the underlying evidence runtime deliberately reuses the older normalized ReadingPosition[] contract. The adapter must bridge these shapes without changing the reading boundary.

## Trust-boundary flow

1. The topic-interest gateway validates the request and live SQLite v2 progress identity.
2. The local answer port receives only canonical approved claim IDs and the v2 progress snapshot.
3. The adapter calls projectHoidCursorProgressSnapshot(), which validates every cursor against its edition manifest.
4. Only the completed-through ReadingPosition[] projection is passed to HoidEvidenceRuntime.renderApprovedClaimById().
5. The runtime independently verifies the claim intent, knowledge entries, first-safe-appearance thresholds, evidence unlocks and source citations.
6. The original v2 snapshot is passed to presentHoidEvidenceAnswer() and the topic recommendation composer.
7. The gateway rechecks both the caller-owned snapshot and the live progress coordinator after the local port completes.

The open chapter is never treated as completed. Each source work has an independent unlock boundary; a cross-book claim is withheld unless every source is authorized.

## Regression discovered and fixed

The Run 140 adapter forwarded the v2 snapshot directly to renderApprovedClaimById(), whose contract accepts normalized ReadingPosition[] values. The runtime therefore rejected every production topic claim even though the gateway had validated the snapshot. The initial CI failure exposed this mismatch.

The adapter now performs the explicit cursor projection before invoking the runtime. The associated presentation test also uses the v2 snapshot required by presentHoidEvidenceAnswer(), rather than passing the legacy reading array.

## Verification

Synthetic tests cover:

- exact local claim rendering without invoking the selector;
- v2 snapshot validation and edition-manifest rejection;
- open-chapter semantics;
- independent cross-book unlock boundaries;
- final presentation against the same v2 snapshot;
- end-to-end topic recommendation composition with synthetic assignments;
- withholding when one cross-book source remains locked;
- malformed IDs, duplicate IDs and invalid snapshots.

Synthetic assignments and claims are test-only. They are not inserted into production registries and do not represent Cosmere facts.

## Production state

HOID_APPROVED_TOPIC_ASSIGNMENTS remains empty. The production UI therefore continues to return a neutral no-reviewed-matches result. This implementation does not promote editorial knowledge, alter reading progress, or add a language-provider fallback.

No private EPUB/XHTML bodies, protected passages or images are committed.
