# Run 141 — cursor-native approved-claim rendering and recommendation assurance

## Defect found in Run 140

The explicit-topic gateway passes the authoritative SQLite v2 cursor snapshot to its local answer port. HoidEvidenceRuntime.renderApprovedClaimById() intentionally accepts the legacy, normalized ReadingPosition[] contract used by the evidence core. Run 140 forwarded the v2 snapshot directly, so the runtime rejected it. Its first CI run exposed a second symptom: the presentation test passed a legacy reading array to presentHoidEvidenceAnswer(), although that boundary requires the authoritative v2 cursor snapshot.

## Corrected adapter boundary

topicApprovedClaimAnswerPort.ts now:

1. accepts the full SQLite v2 cursor snapshot supplied by the gateway;
2. calls projectHoidCursorProgressSnapshot() to validate the snapshot against edition manifests;
3. passes only the projected completed-through ReadingPosition[] to renderApprovedClaimById();
4. returns only an exact, authorized, one-segment result for the requested claim ID.

The projection preserves the cursor rule: if chapter N is open, only chapters before N are complete. An invalid snapshot, stale edition or unavailable cursor yields an empty result. The original v2 snapshot remains the input to presentHoidEvidenceAnswer() and to the topic recommendation composer.

## End-to-end synthetic assurance

The adapter tests now exercise the real boundary shapes and a local recommendation composition path:

- a v2 snapshot unlocks evidence only after the cursor advances past its unlock chapter;
- the same v2 snapshot is accepted by final answer presentation;
- cross-book claims require each source work's own cursor to pass its unlock boundary;
- the local adapter never invokes the selector;
- exact claim text, evidence IDs and citations survive recommendation composition;
- malformed snapshots and non-recommendation claims abstain;
- the empty production registry remains unchanged.

All synthetic claims and assignments are original test fixtures. They do not represent Cosmere facts and are never inserted into production registries.

## Production behavior

The production topic-assignment registry remains empty. The new tests validate the pipeline with injected synthetic registries only; Hoid continues to show a neutral no-reviewed-matches result until authentic assignments and claims pass the protected editorial review process.

No external provider fallback is added. No reading progress is changed. No private EPUB/XHTML body, protected passage or image is committed.
