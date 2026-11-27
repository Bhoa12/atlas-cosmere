# Hoid Run 353 — progress-bound character evolution dossiers

## Objective

Add a character-evolution explanation capability that organizes already approved dossier claims by editorial dimension while preserving the reader's current book/chapter boundary. This is a progressive evidence dossier, not an inferred biography or story-time chronology.

## Editorial model

A character-evolution annotation references one existing approved entity-dossier claim. It contains:

- the canonical character entity ID;
- the existing dossier claim ID;
- one closed dimension: perspective, knowledge, capability, affiliation, relationship, status, motivation or cause;
- one editorial evidence kind: state or transition;
- a review record bound to the canonical claim and annotation digests.

No annotation carries free-standing narrative text. The adapter displays the original approved claim wording and its existing chapter citations.

A transition label is an explicit editorial classification. It is not inferred from chapter order or from two unrelated state claims. A cause annotation additionally requires a transition classification and an approved explain claim. A relationship annotation requires at least two verified participants. Recommendation claims are never evolution facts.

Review digests detect content drift. They are not digital signatures, reviewer authentication or a replacement for trusted-host promotion.

## Evidence ordering semantics

The adapter groups claims by dimension and source work. Within a single-work group, claims are ordered by the earliest completed-through watermark at which all of their evidence is available. Claims supported by multiple works are kept in a separate trailing group.

This order is strictly **reading-order evidence availability**. It does not assert:

- in-world chronology;
- simultaneity;
- causality;
- personality development;
- a transition between two states unless an editor explicitly reviewed a transition claim.

Bibliography order, publication order, chapter numbers across different works and model inference are never used to construct a story chronology.

## Spoiler and provenance boundary

For every request the adapter:

1. classifies the question deterministically and extracts an exact character name;
2. canonicalizes the selected work scope and explanation depth;
3. refreshes the durable cursor and compares revision plus fingerprint with the request;
4. resolves only a kind: character dossier through the branded local dossier gateway;
5. revalidates entity identity, every alias source, summary provenance, participant identities, chapter locators, work scope and every completed-through watermark;
6. selects only annotations whose approved claims are present in that authorized dossier;
7. validates each claim and annotation digest, and enforces dimension-specific participant and intent rules;
8. applies the existing depth budget after authorization; over-budget results are withheld whole;
9. projects every citation through the existing UI-safe answer-display boundary;
10. refreshes durable progress again and discards the complete answer if revision or fingerprint changed.

An open cursor at chapter N authorizes only the existing completed-through boundary. Depth changes presentation capacity only and never widens spoiler authorization. Unknown and locked characters produce the same neutral not-found result. A missing claim may be locked or outside the selected scope and is not distinguished.

## Provider and mutation boundary

The adapter accepts only a branded local dossier gateway and an opaque branded annotation index. The annotations are held in a private WeakMap; internal evidence IDs, EPUB locators and unlock thresholds do not enter React message state.

The capability adds no provider port, network client, persistence, graph mutation, progress write, navigation, source-file reader, claim promotion or automatic spoiler authorization. Recognized evolution questions are routed locally in HoidScreen; unknown, locked, invalid and unavailable requests never fall through to a language provider.

## Run 352 validation repairs included in this branch

The audit of Run 352's completed Actions runs exposed three deterministic defects:

- the magic-system intent parser contained an invalid escaped quote in a regular-expression character class, preventing its test suite from loading;
- the magic-system adapter accessed gatewayResult.dossier before narrowing the discriminated result to status: ready;
- HoidScreen accessed mode and intent on a conversation-intent union without first proving the result was ready.

This branch fixes the regex and gateway narrowing. The screen now derives a nullable intentMode only from the ready variant and explicitly blocks the generic trusted-conversation path if the intent remains unavailable. The specialized local route remains available for recognized magic and character-evolution requests.

## Production status

HOID_CHARACTER_EVOLUTION_ANNOTATIONS is intentionally empty. This run does not assert any real Cosmere character change, relationship, cause or chronology. Production use requires original editorial claims checked against accessible passages, individually verified edition-bound chapter metadata, independent review and trusted-host promotion.

No private EPUB bytes, XHTML, protected prose, private filesystem paths or locators are committed. Tests use original synthetic names, claims and metadata only.

## Tests

Fifteen synthetic tests cover Spanish/English intent routing, exact-name extraction, dimension filters, state/transition labeling, recommendation exclusion, relationship participant requirements, cause review requirements, chapter citations, UI data minimization, unknown/locked equivalence, stale progress, cancellation, provider-bearing configuration, duplicate annotation identities, review-digest drift, comparative-depth withholding and the empty production registry.
