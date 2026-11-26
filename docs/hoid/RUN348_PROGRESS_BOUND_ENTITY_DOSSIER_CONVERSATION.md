# Hoid Run 348 — conversational entity dossiers

## Objective

Expose the existing progress-bound entity dossier as a local conversational capability in HoidScreen. A direct question such as “¿Quién es Vin?” or “Háblame de Kaladin” is routed to the approved dossier projection before the trusted narrative-answer port. It never falls through to an LLM when the dossier lookup is unknown, ambiguous, locked, malformed or unavailable.

This is a read-only projection over the existing production registries. It does not introduce a second knowledge store, graph, claim registry, review queue or promotion path.

## Components

- \`entityDossierIntent.ts\` parses a small, deterministic set of Spanish and English dossier cues and extracts one exact lookup string. It does not fuzzy-match, infer entities, or generate candidates.
- \`entityDossierGateway.ts\` now accepts an optional canonical \`bookScope\`. The entity identity source and every mandatory alias-disclosure source must belong to the selected scope; the entity summary must also originate inside it, and every source attached to a claim must belong to it. A cross-work claim is omitted unless all its source works are selected.
- \`entityDossierConversation.ts\` composes the local gateway with durable progress refresh, exact work-scope validation, depth budgets and the existing one-way answer display projection.
- \`HoidScreen.tsx\` routes dossier requests locally before the trusted provider-backed conversation port and renders only the safe display projection and chapter citations.

## Request and response flow

1. The UI refreshes the authoritative cursor-v2 progress snapshot.
2. The deterministic intent parser recognizes an exact dossier request. A missing entity name produces a local clarification. Invalid recognized requests are blocked rather than sent to a provider.
3. The reading-focus resolver must provide a valid single-work or cross-work scope. Multi-work focus selection remains explicit.
4. The adapter refreshes progress and compares revision plus fingerprint with the request.
5. The production dossier gateway reads only \`HOID_EDITORIAL_KNOWLEDGE\`, \`HOID_APPROVED_CLAIMS\` and \`HOID_ENTITY_ALIAS_EVIDENCE\`.
6. The gateway validates entity identity, approved aliases, summary watermark, claim attestations, all evidence thresholds and every participant identity. The scope filter also requires the entity identity and every mandatory alias-disclosure source to belong to the reader-selected work set; summaries and claims are filtered by the same scope.
7. The adapter applies the selected explanation-depth budget without truncating claims or dependent evidence. It projects exact chapter locators to the existing UI-safe citation model.
8. Progress is refreshed again. Any revision/fingerprint change discards the complete presentation.
9. The screen performs its existing final progress comparison before committing text to chat state.

## Spoiler semantics

- Cursor chapter N means N is open; only chapters through N-1 are complete.
- Entity appearance, alias disclosure, summary watermark, each claim evidence item and every participant identity remain separate gates.
- Every source attached to one claim is mandatory (AND semantics).
- A single-work focus cannot receive claims supported by another work.
- A cross-work focus can receive a claim only when every evidence work is in the selected set.
- Unknown, locked and ambiguous entity lookups produce the same neutral user-facing not-found message.
- The adapter never falls back to the generic conversation runtime after a recognized dossier query fails.
- A stale progress read, cancelled turn, invalid scope or failed projection discards the result.

## Depth budgets

The existing \`HoidExplanationDepth\` budgets are reused:

- \`brief\`: at most 3 segments, 4 distinct evidence items, 2 works and 6,000 characters.
- \`detailed\`: at most 8 segments, 12 evidence items, 4 works and 18,000 characters.
- \`comparative\`: at most 12 segments, 16 evidence items, 4 works and 24,000 characters, with at least two source works and at least one individual claim segment supported by two or more works.

The summary is one segment. If the complete dossier exceeds a budget, it is withheld; claims are not silently truncated or rewritten.

## Provider, persistence and copyright boundaries

- No provider port exists in the dossier adapter.
- The UI routes recognized dossier questions before the trusted conversation port.
- The adapter accepts no provider configuration and rejects extra configuration keys.
- The adapter also requires a branded gateway instance created by `createHoidEntityDossierGateway`; a shape-compatible object supplied by an untrusted caller is not a capability grant.
- No raw EPUB/XHTML, source passages, local paths, internal locators, evidence IDs or unlock thresholds enter React message state.
- The display projection reuses \`projectHoidAnswerForDisplay\`, retaining only canonical work titles, chapter numbers, stable chapter ordinals and original approved editorial wording.
- No SQLite write, progress mutation, graph mutation, claim promotion or spoiler authorization occurs.
- No source text is copied into the repository. Tests use synthetic fixtures only.

## Production availability

The production factory remains bound to the existing source-controlled registries. Those registries are still empty until the independent reviewer quorum and trusted-host promotion process populates them. Therefore this route is architecturally wired but will return the same neutral not-found response for all names until approved production dossiers exist. Synthetic tests do not establish narrative facts.

## Validation

The dedicated workflow runs:

- deterministic intent parser tests;
- dossier conversation adapter tests;
- scoped dossier gateway tests;
- entity resolver and approved-claim integrity regressions;
- evidence runtime and knowledge graph regressions;
- answer display projection tests;
- strict TypeScript checking, including \`HoidScreen.tsx\`.

The implementation does not claim that the workflow has passed until GitHub Actions reports success for the final branch HEAD.
