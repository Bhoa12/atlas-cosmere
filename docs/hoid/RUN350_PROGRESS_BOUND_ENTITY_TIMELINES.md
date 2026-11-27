# Hoid Run 350 — progress-bound entity timelines

## Objective

Provide a deterministic, local timeline view for an entity using only claims already present in its progress-bound approved dossier. The feature is a reading-order evidence view, not an inferred chronology of events in the fictional world.

## Components

- `entityProgressTimelineIntent.ts` recognizes narrow Spanish and English timeline/evolution prompts and extracts an exact alias lookup key.
- `entityProgressTimeline.ts` reads one branded `HoidEntityDossierGateway`, refreshes the durable cursor before and after retrieval, validates edition-bound evidence and projects a safe timeline.
- `HoidScreen.tsx` routes recognized timeline prompts to the local adapter before the generic trusted conversation port.
- `entityProgressTimeline.test.ts` uses synthetic entities and original synthetic claims only.

## Temporal semantics

A claim supported by evidence from one work appears in that work's independent track. Within the track, entries are sorted by the latest unlock watermark required by their evidence, then by source chapter and stable claim ID. The unlock watermark is used internally only and is never exposed to React state.

Claims whose evidence spans multiple works are placed in a separate cross-work section. They are explicitly marked as unordered; the adapter never sorts different works into a global story chronology.

The response labels this as a reading-order evidence sequence. Source chapter means where the approved editorial claim is documented. It does not assert when an event occurred in-world, nor whether one character change caused another.

A future story-time chronology requires a separate editorially reviewed temporal relation contract. Publication order, bibliography order, chapter-number comparison across works, or model inference are not accepted substitutes.

## Authorization and spoiler boundary

1. Resolve the entity through the branded local dossier gateway; unknown, ambiguous and locked entities remain neutral.
2. Require the dossier progress revision and fingerprint to match the requested cursor snapshot.
3. Refresh durable progress before and after retrieval; discard the complete result if the revision or fingerprint changes.
4. Revalidate every identity, alias, summary and claim citation against the selected book scope and the edition-bound chapter locator.
5. Require every source's completed-through unlock watermark to be satisfied. An open cursor on chapter N authorizes only through N-1.
6. Exclude recommendation claims from the evolution timeline.
7. Do not truncate an over-budget dossier; withhold the whole timeline.
8. Project citations through `projectHoidAnswerForDisplay`. Internal evidence IDs, EPUB locators and unlock watermarks do not enter React message state.

## Provider and persistence boundaries

The adapter has no provider port, provider configuration, persistence API, graph mutation, claim promotion, progress write or navigation capability. Provider-bearing configuration and unbranded gateway objects are rejected.

The generic provider route is not used as a fallback for recognized timeline requests, including unknown, locked, ambiguous and unavailable entities.

## Output contract

- `semantics: reading-order-evidence`
- independent per-work tracks ordered by evidence availability
- cross-work items explicitly unordered
- original editorial summary with a projected chapter citation
- progress revision and fingerprint for stale-response rejection

The display contract intentionally omits internal claim/evidence IDs, locators, edition hashes and unlock thresholds.

## Regression repairs carried on this branch

- The relationship adapter now narrows each gateway result independently and first requires the explicit `ready` discriminant before reading `dossier`. The gateway's grouped `ambiguous | not-found` variant is handled as neutral not-found; all other non-ready variants fail closed. This fixes strict TypeScript failures inherited by relationship, dossier, recommendation, progress and presentation workflows.
- The comparative dossier fixture now includes every declared entity ID in its attested evidence IDs and separates the single-work and cross-work support entries. The previous fixture was invalid at the attestation boundary; no production validation was weakened.

## Source and copyright policy

The timeline consumes only existing approved original-editorial claims and metadata. Tests use synthetic names and synthetic claim text. No EPUB/XHTML bytes, chapter prose, private paths or private locators are committed. The production editorial, approved-claim and alias registries remain subject to their independent review and trusted-host promotion process.

## Validation

The dedicated workflow runs timeline parser and adapter tests plus relationship, dossier, resolver, claim-integrity, evidence-runtime, graph and display-projection regressions. It also strictly type-checks the timeline, relationship adapter and `HoidScreen.tsx`.

No passing result is claimed until GitHub Actions completes on the final Run 350 HEAD.
