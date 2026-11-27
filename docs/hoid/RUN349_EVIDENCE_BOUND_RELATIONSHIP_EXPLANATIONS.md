# Hoid Run 349 — evidence-bound relationship explanations

## Objective

Add a local conversational capability for questions that explicitly ask how two known entities are related. A relationship is presented only when the same independently approved claim is available in both progress-bound entity dossiers.

The feature is a read-only composition over the existing dossier gateway. It does not create a relationship registry, infer edges from co-occurrence, mutate the knowledge graph, or call a language provider.

## Components

- `entityRelationshipIntent.ts` recognizes a narrow set of Spanish and English two-entity relationship prompts. It extracts exact lookup strings only. Missing names request clarification; ambiguous conjunctions and self-comparisons are rejected.
- `entityRelationshipConversation.ts` queries the branded dossier gateway twice against one authoritative progress snapshot and one canonical book scope.
- `HoidScreen.tsx` routes recognized relationship prompts to this local adapter before the generic trusted conversation port.
- `entityRelationshipConversation.test.ts` uses synthetic entries and synthetic editorial attestations only.

## Relationship proof rule

A relationship is not inferred because two entities appear in the same book, chapter, summary or conversation.

For a candidate claim to be presented:

1. Both exact entity lookups must resolve to one unambiguous, authorized dossier.
2. Both dossiers must carry the same progress revision and fingerprint.
3. The claim ID must occur in both dossiers.
4. The canonical claim text, intent, participant identities/labels and complete source set must match exactly between dossiers.
5. The participant set must contain both resolved entity IDs.
6. Every source must be inside the selected book scope and unlocked at the same cursor snapshot.
7. The answer must fit the selected explanation-depth budget without truncation.
8. Comparative depth additionally requires one individual relationship claim segment to cite at least two distinct works.

If a claim appears in only one dossier, it is not used. If the same claim ID has different content or provenance in the two dossiers, the whole relationship result is withheld.

## Spoiler and privacy boundaries

- Cursor chapter N means N is open; only chapters through N-1 are complete.
- Identity, alias, summary, participant and claim evidence remain separately gated by the existing dossier gateway.
- The relationship adapter refreshes durable progress before and after both dossier reads. Any revision/fingerprint change discards the result.
- Unknown and locked entities produce the same neutral not-found result.
- Recognized relationship questions never fall through to a provider when a lookup is missing, locked, ambiguous or unavailable.
- The adapter accepts only the branded local dossier gateway and a progress refresh function; provider configuration is rejected.
- Internal evidence IDs, EPUB locators and unlock thresholds are removed by the existing answer display projection before the result enters React message state.
- No progress write, chapter navigation, SQLite mutation, graph mutation, claim promotion or spoiler authorization is introduced.

## Intent parsing

Supported forms are intentionally narrow:

- `¿Qué relación hay/existe entre A y B?`
- `¿Qué conexión hay/existe entre A y B?`
- `¿Cómo se relacionan / están relacionados A y B?`
- `¿Qué relación tiene A con B?`
- `¿Qué une a A y B?` / `¿Qué tienen en común A y B?`
- `Relación entre A y B`
- `What is the relationship between A and B?`
- `How are A and B connected/related?`

Accented and unaccented Spanish forms are accepted. Only one conjunction is accepted. If a name itself contains an ambiguous conjunction, the parser abstains rather than guessing a split. Other relationship cues detected by the broader intent classifier but not covered by the exact-name grammar are also stopped locally and asked to be reformulated; they never fall through to a provider. The resulting names are exact alias lookup keys; there is no fuzzy matching or model-generated candidate list.

## Run 348 CI correction

The first Run 348 relationship-adjacent regression matrix exposed one failing comparative-depth fixture. The fixture used a synthetic evidence entry at `twok` chapter 1, but that chapter did not have an individually registered XHTML digest in the verified-document allowlist. The attestation factory correctly rejected it as `unverified-source`.

The fixture now uses `twok` chapter 2, whose edition-bound XHTML digest is registered, and the helper includes the exact rejection reason in any future failure. No production validation rule was weakened.

## Source and copyright policy

All tests use synthetic entity names, summaries and claim wording. No private EPUB, XHTML, chapter prose, local path or private locator is committed. The feature consumes only the existing approved registries. Those production registries remain empty pending independent editorial review and trusted-host promotion, so no real narrative relationship is currently available to this route.

## Validation

The dedicated workflow runs:

- relationship intent parser tests;
- relationship conversation tests;
- dossier intent, conversation and gateway tests;
- entity resolver and approved-claim integrity regressions;
- evidence runtime, knowledge graph and answer display projection tests;
- strict TypeScript checking including `HoidScreen.tsx`.

No passing result is claimed until the workflow completes on the final Run 349 HEAD.
