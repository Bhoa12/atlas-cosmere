# Run 129 — deterministic narrative composition and provider-neutral layout

## Purpose

Turn a validated set of exact editorial claims into a readable answer structure without allowing a language model to rewrite, paraphrase, translate, summarize or extend factual content.

The composer is local and deterministic. It runs only after relationship presentation has validated that the graph explanation text is exactly the ordered concatenation of its evidence-bearing claim segments and that every source matches the registered edition, navigation digest, inspected chapter document and unlock threshold.

## Claim-preserving composition

The composeHoidNarrative function accepts a dense array of one to twelve segments. Each segment must have:

- a unique canonical claim ID;
- non-empty, trimmed editorial text;
- one to sixteen unique evidence IDs;
- no unsupported properties, accessors, sparse entries or invisible formatting controls.

The total source claim text is bounded to 32,000 characters. The composer preserves claim wording, claim order and evidence IDs exactly. It adds only neutral formatting:

| Layout | Rendering |
|---|---|
| plain | Exact claim text joined by paragraph breaks |
| numbered | Ordered numeric markers before each exact claim |
| grouped | Consecutive groups of at most three claims with neutral block labels |

No heading describes a relationship type, cause, shared property or narrative interpretation. The composer does not infer semantics from claim wording.

The production relationship presentation uses a deterministic local default: one claim is plain, two or three claims are numbered, and four or more claims are grouped. The original explanation text is validated before this formatting step. The resulting answer still passes through the existing evidence presentation and progress checks.

## Provider-neutral layout port

HoidNarrativeLayoutPort is an optional asynchronous port for a future language provider. Its request contains only:

- schema version;
- fixed locale (es);
- number of approved claims;
- number of already-resolved entities;
- the closed layout allow-list (plain, numbered, grouped).

It receives no question, entity names, claim text, claim IDs, evidence IDs, source metadata, locators, EPUB bytes or protected passages. It can return only one of the three literal layout values.

selectHoidNarrativeLayout enforces a short timeout. Missing providers, rejected calls, timeouts and unrecognized output use the deterministic local layout. The provider cannot add or remove claims, reorder them, author transitions or influence evidence authorization.

This is a layout-selection contract, not a production provider integration. No remote provider is configured by this change.

## Trust and failure policy

- Invalid segment envelopes are rejected.
- Duplicate claim IDs or duplicate evidence IDs within a segment are rejected.
- Provider output is accepted only when it is exactly one allow-listed string.
- Provider failure changes presentation style only; it cannot change the answer's factual content.
- The original claim-to-evidence mapping remains unchanged.
- The relationship presenter still revalidates progress, source identity, edition ID, navigation SHA-256, chapter locator, document SHA-256 and unlock thresholds.
- No partial or provider-authored narrative is returned.

## Tests

narrativeComposition.test.ts covers deterministic layouts, exact claim preservation, grouped output, duplicate IDs, sparse arrays, accessors, unexpected properties, invisible controls, invalid styles, provider allow-list isolation and safe fallback on provider errors.

relationshipPresentation.test.ts verifies that the new formatting is applied only after the original graph text and source mappings have passed the existing integrity checks.

## Production and source status

The production editorial and alias registries remain empty pending independent review. This change creates no Cosmere facts, does not promote staging drafts, does not change reading progress and does not inspect new EPUB chapters.

Only original editorial claim text already present in the repository's staging/runtime contracts is formatted. No EPUB, XHTML body, extracted passage, image or protected narrative text is added.
