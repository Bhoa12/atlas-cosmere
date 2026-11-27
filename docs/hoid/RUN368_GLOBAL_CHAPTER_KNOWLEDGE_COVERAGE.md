# Run 368 — Global chapter knowledge coverage

## Goal

Run 367 introduced a per-work, per-reading-unit readiness projection. Run 368 adds a deterministic catalogue-wide aggregate and exposes it in the existing source coverage panel.

## Architecture

- \`chapterKnowledgeReadiness.ts\` remains the single-work source of truth.
- \`chapterKnowledgeCoverage.ts\` aggregates the readiness reports for the 24 bibliography entries.
- \`HoidSourceCoveragePanel.tsx\` displays catalogue totals and the selected work's chapter-level stages.
- No provider, network client, persistence layer or answer runtime is introduced.

## Independent stages

The aggregate keeps these counts separate:

1. Reading units in a verified manifest.
2. Navigation-verified units.
3. Identity-only units where a visible chapter number is ambiguous.
4. Units with a registered body-document digest.
5. Original summaries pending editorial review.
6. Production knowledge entries.
7. Approved-claim references.

An unavailable manifest has \`counts: null\`; it is not represented as a work with zero chapters or zero knowledge.

## Explicit non-claims

The global report sets local availability to \`not-audited\`. It does not inspect the currently selected EPUB and does not infer that private source bytes are mounted.

A registered digest is not a review receipt. A staged summary is not production knowledge. A production entry count is not permission to disclose its content.

The report includes no chapter text, summary text, EPUB locator, document digest, source path, URI, reader cursor or progress snapshot.

## Safety boundary

The aggregate is metadata-only and has no authorization, progress or spoiler-unlock effect. The exact-unit evidence runtime and spoiler-dependency gate remain the only narrative authorization path.

The UI uses the aggregate for coverage visibility only. It does not feed the counts into recommendation ranking or answer selection.

## Validation

The dedicated workflow runs:
- Chapter readiness tests.
- Global aggregation tests.
- Existing source coverage regressions.
- Strict TypeScript checks for the aggregate and UI panel.

All test fixtures use the repository's existing metadata registries. No private EPUB bytes are uploaded or added to Git.
