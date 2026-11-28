# Hoid Run 384 — magic-system application integration

## Objective

Move the existing progress-bound magic-system explanation route behind the provider-neutral conversation application service. This extends the shared application boundary to the magic-system capability without replacing its reviewed-fact engine.

## Composition

- HoidScreen retains the UI turn ticket and a short-lived magic-system dispatch snapshot.
- \`createHoidMagicSystemExplanationApplicationAdapter\` accepts only a ready \`magic-system\` route.
- The dispatch binds the exact system name and optional facet parsed from the original question.
- The application service validates the durable progress revision/fingerprint before dispatch and after the handler returns.
- The existing \`HoidMagicSystemExplanationAdapter\` remains responsible for dossier resolution, reviewed fact annotations, claim/annotation digests, source and unlock chapters, selected-work scope, citations and explanation budgets.

## Spoiler and evidence guarantees

- The application adapter is orchestration only; it is not an evidence authority.
- It rejects non-magic routes, incomplete or invalid intents, mutable dispatch snapshots, mismatched system names/facets and stale turns.
- The magic-system engine remains authoritative for reviewed annotations, evidence unlocks, book scope, citations and explanation budgets.
- The layer never infers rules, costs, exceptions, interactions or causal explanations and never reads EPUB/XHTML.
- A progress change before or after execution discards the complete result.
- Cancellation and superseded turns map to stable unavailable results.
- There is no generic-provider fallback and no provider selection in this adapter.

## Current editorial data status

The production \`HOID_MAGIC_SYSTEM_FACT_ANNOTATIONS\` registry is empty. The route is now wired through the application service, but the magic-system engine will correctly return no approved explanation until original editorial claims and facet annotations are independently reviewed and promoted by the trusted host. This integration does not invent or seed Cosmere facts.

## Data minimization

The application context contains only schema version, turn sequence, route and progress revision/fingerprint. The active dispatch is ephemeral and cleared in a \`finally\` block; it is not persisted to message history or SQLite.

No EPUB bytes, XHTML, source passages, private paths, raw evidence locators or provider payloads are added.

## Validation

The dedicated workflow runs:
- the new magic-system application adapter tests;
- existing magic-system fact-index, evidence, unlock, citation and budget tests;
- application-service, route-execution and route-plan tests;
- HoidScreen trusted-wiring assertions;
- strict TypeScript compilation for the adapter, existing magic-system engine and HoidScreen.

The TypeScript command uses ES2020 module output because the trusted screen integration test intentionally uses \`import.meta.url\`; CommonJS mode rejects that syntax even though the test suite itself passes.

## Source and branch isolation

- Base: \`feat/hoid-ia-core-run383\`.
- New work is isolated on \`feat/hoid-ia-core-run384\`.
- No write targets \`main\` or any earlier feature branch.
- The Run 383 workflow's Vitest step passed 83 tests; its TypeScript step failed because it compiled \`trustedScreenIntegration.test.ts\` with \`--module commonjs\`. Run 384's dedicated workflow uses \`--module es2020\` for the same strict check. The earlier PR remains unchanged and its failed check is not retroactively represented as passing.
