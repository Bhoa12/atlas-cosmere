# Run 135 — reviewed coreference and spoiler-safe pronoun follow-ups

## Purpose

Run 135 adds a narrow, source-reviewed coreference boundary for Spanish third-person singular follow-ups. It extends the session-local ID-only relationship context from Run 134 without storing names, aliases, prior questions, prose, citations or provider output.

The first supported forms are exactly `él` and `ella`, and only a closed set of short follow-up cues is recognized. This is not a general Spanish coreference engine.

## Record contract

`coreferenceRegistry.ts` defines metadata-only records containing:

- a canonical record ID;
- one canonical entity ID;
- one explicit pronoun form (`él` or `ella`);
- one or more mandatory source evidence items;
- structural editorial review metadata.

Each evidence item stores an exact bibliography work, chapter, edition ID, navigation SHA-256, chapter-document SHA-256, edition-bound locator and same-work unlock threshold. The resolver compares all three edition/document identities against the current manifest and sparse inspected-document registry; a digest change invalidates the record.

The form is an explicit editorial mapping supported by the cited document. It is never inferred from a name, avatar, provider response, assumed gender, grammatical stereotype or a previous answer.

The production registry is intentionally empty. Adding records requires source inspection, editorial verification and protected source-control review. The `review` object is structural metadata and is not, by itself, authentication of the reviewer.

## Resolution rules

`coreferenceResolver.ts` performs these steps:

1. Match the complete normalized question against a closed cue allow-list. Prefix matches and arbitrary trailing noun phrases are not accepted.
2. Validate the existing relationship context through the Run 134 context contract and exact progress revision/fingerprint.
3. Reauthorize every canonical entity ID in that context using the current production entity and alias registries.
4. Validate the complete coreference registry, including record uniqueness, review shape, source locator, edition/navigation identity and individually inspected chapter-document digest.
5. Find records for the requested pronoun among the current context IDs.
6. Require every evidence item for every matching candidate to be unlocked (AND semantics).
7. Resolve only when exactly one authorized candidate remains and no matching candidate is hidden behind an unlock boundary.

A matching but locked candidate blocks uniqueness. The resolver never silently ignores it and selects another visible candidate.

## Provider boundary

For a person-focused follow-up, the conversation gateway passes the original user question plus only the single reauthorized canonical entity ID to the strict evidence runtime. It does not pass the prior context, the pronoun-to-entity mapping record, alias lists, source prose or reviewer metadata. If the follow-up is explicitly relational, a two-entity context is required and the local relationship graph receives the two canonical IDs; contexts with three or four entities abstain because the counterpart would be ambiguous. The graph path does not send those IDs to a language provider.

The runtime still selects only local approved claim IDs and Hoid renders exact local claim text. The existing answer-presentation boundary revalidates every evidence item and unlock before the UI displays the result.

If the pronoun cannot be resolved, the request abstains before the answer runtime and before the relationship graph. It never falls through to a general provider.

## Progress freshness

The resolver validates the exact SQLite v2 progress revision and fingerprint. It rechecks the live progress after the asynchronous answer call. If progress changes, the entire answer is discarded and the screen clears the ephemeral context and all provenance fields.

## Supported and unsupported language

Supported examples include exact short follow-ups such as:

- `¿Y él?`
- `¿Y ella?`
- `¿Y qué sabes de él?`
- `¿Y cómo se relaciona con ella?`

The resolver deliberately does not support plural pronouns, possessives, demonstratives, nested clauses, ellipsis beyond the allow-list or arbitrary pronoun chains. Unsupported or ambiguous phrasing abstains.

## Tests

The dedicated suite covers:

- unique masculine and feminine mappings;
- exact-cue matching and noun-phrase false positives;
- multiple matching entities;
- locked candidates that must block uniqueness;
- cross-work AND unlock semantics;
- reauthorization of every context entity;
- stale progress;
- missing context;
- uninspected chapter documents;
- duplicate mappings;
- accessor-backed hostile records;
- invalid progress and review metadata;
- empty production registry abstention;
- gateway ID-only routing;
- no runtime/graph fallback on ambiguity;
- progress changes during asynchronous generation.

All fixtures are synthetic and do not assert Cosmere facts.

## Source and copyright boundary

The production registry remains empty until private EPUB source passages are accessible and individually inspected. This change adds no narrative facts, aliases, summaries, EPUB bytes, XHTML bodies, protected passages or images. It stores only contracts and test fixtures.
