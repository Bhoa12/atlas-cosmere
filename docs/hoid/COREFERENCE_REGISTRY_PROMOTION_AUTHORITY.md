# Run 136 — reviewed coreference registry promotion

## Purpose

Run 136 adds a separate promotion authority for the metadata-only Spanish singular-pronoun registry introduced in Run 135. It does not add any character mapping or narrative fact.

## Registry audit

The coreference resolver now exposes a metadata-only registry audit. It validates every record through the same source checks used at resolution time and returns only sorted record IDs, entity IDs, reviewer IDs and deterministic SHA-256 fingerprints.

The audit binds each record to:
- exact work and chapter;
- edition ID and navigation digest;
- edition-bound locator;
- individually inspected chapter-document digest;
- same-work unlock threshold;
- explicit pronoun form;
- structural editorial reviewer ID and timestamp.

No source prose, chapter body, EPUB bytes, aliases or provider output are returned.

## Promotion plan and manifest

The promotion plan fingerprints the complete registry and its source evidence together with the authoritative SQLite v2 progress revision and fingerprint. The manifest path is fixed to `docs/hoid/coreference-promotion.manifest.json`.

Any change to a record, reviewer, source locator, edition, navigation digest, document digest, unlock threshold or progress invalidates the plan. Empty production registries return `no-coreference-records`.

## Protected source-control review

The core remains provider-neutral and imports only the `HoidSourceControlReviewPort` and `HoidPromotionProgressPort` contracts. The configured adapter must fetch the open, non-draft PR, effective reviews, protected branch/ruleset state and the exact manifest at the expected head SHA.

The core reuses `verifyHoidProtectedReviewSnapshot()`, then additionally requires every reviewer named in the registry to be an authenticated, non-author approval on that exact head. Structural review fields inside a registry record never authenticate a person.

The authoritative progress port is read before and after the asynchronous source-control check. Any revision or fingerprint change fails closed.

## Result semantics

A successful result is only `ready-for-maintainer-commit`. It always keeps:
- `promotionAllowed: false`;
- `productionWritePerformed: false`.

The authority never writes `coreferenceRegistry.ts`, never changes reading progress and never merges a PR. A maintainer must create a separate reviewed source change under repository branch protection.

## Run 135 regression repair

The pronoun matcher now preserves Spanish diacritics during normalization and uses explicit accented `él` cues. The unaccented article form `el` is rejected as an ambiguous pronoun rather than being normalized into the same token.

Context freshness is validated through a dedicated `validateHoidConversationContext()` function instead of synthesizing a group-level question. Test fixtures use the verified TFE chapter-one document and chapter-two unlock, with the cross-work case retaining a separately verified Edgedancer threshold.

## Validation

The dedicated workflow runs the registry audit, promotion plan/manifest, protected-review authorization, pronoun resolver, conversation context, entity resolver, relationship gateway and conversation gateway tests, followed by strict TypeScript checks including `HoidScreen.tsx`.

All fixtures are synthetic. The production coreference registry remains empty until private source documents are individually inspected and editorial review is independently authenticated.
