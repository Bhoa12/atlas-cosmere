# Run 345 — cross-work multi-source atomic claim staging

## Objective

Extend the Run 344 local-review bridge to claims that genuinely require evidence from more than one Cosmere work. This is a staging adapter only: it reuses the canonical atomic-claim schema and does not introduce a second claim model.

## Contract

`buildHoidLocalReviewMultiSourceAtomicClaimCandidate(sources, claim)` accepts:

- two to eight source-review pairs;
- one validated local editorial packet and its matching local receipt per source;
- one separately authored atomic assertion.

Every source pair must have a local `approved-awaiting-trusted-promotion` decision, a unique chapter identity, an edition-bound manifest match and a document digest already present in the sparse individually verified chapter corpus. At least two distinct works are required. Duplicate source units, unsupported chapters, malformed records and accessor-backed inputs fail closed.

## Evidence and progress semantics

The adapter creates one `HoidEditorialClaimDraft` with one evidence item per source chapter. It deliberately reuses `createHoidEditorialClaimDraft()`, whose canonical evidence validator:

- verifies each source against its exact edition manifest and document digest;
- rejects duplicate source units;
- canonicalizes evidence order;
- limits a claim to eight evidence items.

The existing `evaluateHoidEditorialClaimDrafts()` evaluates every evidence unlock requirement. The semantics are logical AND: a cross-work claim remains withheld until the authoritative cursor snapshot shows that every source book has completed its required chapter. Opening chapter N does not satisfy chapter N's completion threshold.

The adapter does not invent or infer a narrative relationship. The assertion is separately authored and remains subject to independent claim review.

## Trust and spoiler boundaries

- Local reviewer labels and receipts are unauthenticated. Their SHA-256 digest binds data but is not a signature.
- The output is `awaiting-independent-claim-review`; the atomic claim and review packet remain pending.
- No source summaries, EPUB bytes, XHTML or passages are copied into the candidate.
- No persistence, provider egress, production write, progress mutation or spoiler authorization occurs.
- The exact-unit spoiler runtime and signed complete-bundle promotion authority remain mandatory downstream.
- A local approval is not a trusted reviewer quorum or production approval.

## Provider neutrality

The adapter imports only domain contracts and deterministic validation helpers. It has no LLM, network, storage or provider port. Provider-specific summarization or extraction remains outside this boundary.

## Validation

The dedicated workflow runs the multi-source bridge tests plus the existing single-source bridge, atomic draft and review-packet regression suites, followed by strict TypeScript checking.

The tests use synthetic summaries and registered document digests as structural fixtures. They do not claim that the corresponding narrative passages were consulted in this run and do not add protected source text.

## Bibliography and source availability

The immutable 24-work bibliography remains the catalogue. The bridge can only accept a chapter whose exact edition-bound document digest is already in the verified claim corpus; catalogue membership or a local receipt alone does not establish source availability.
