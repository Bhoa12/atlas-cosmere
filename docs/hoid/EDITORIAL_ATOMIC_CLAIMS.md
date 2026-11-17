# Atomic Editorial Claim Drafts

## Purpose

This module introduces a staging contract for one original editorial assertion at a time. It does not add facts to the production registry and it does not expose draft statements to an AI provider.

The goal is to prevent a broad chapter summary from acting as one indivisible spoiler unit when a future explanation needs several independently sourced facts. A claim may cite multiple chapter documents, including documents from different works. Every cited source is a mandatory requirement.

## Contract

HoidEditorialClaimDraft contains:

- A stable claim ID and subject ID.
- A subject kind and a constrained assertion kind.
- A supported response intent.
- One short original statement.
- One to eight edition-bound evidence requirements.
- A statement digest and a canonical claim digest.
- A staging state fixed to pending-review.

Each evidence requirement contains a source work, chapter and exact locator; an unlock work and chapter; and the edition, navigation and chapter-document SHA-256 values.

Each evidence requirement is validated independently against the current manifest. Its unlock threshold must be a real unit in the same work and cannot precede its source chapter. The chapter document must be present in the sparse verified-document allowlist. A plausible digest or locator supplied by a caller is not enough.

## Multi-source authorization

A claim with evidence from several works uses logical AND semantics.

For example, a synthetic claim with one requirement in work A and another in work B is withheld if either work is missing or has not reached its own unlock threshold. Completing work A does not unlock work B's requirement.

evaluateHoidEditorialClaimDrafts() accepts only already-safe ReadingPosition[] values projected by the cursor reading-boundary layer. Callers must not pass the raw current-chapter cursor. A cursor on chapter N is projected to completed-through chapter N-1 before this function is called.

The evaluation result contains claim IDs and missing book/chapter requirements only. It deliberately omits statement text, so the review preview is not a provider-context API.

## Fail-closed behavior

- A malformed claim invalidates the entire batch.
- Duplicate claim IDs invalidate the batch.
- Duplicate source requirements invalidate a claim.
- Unknown works, unsegmented works, ambiguous chapters, stale editions and uninspected documents are rejected.
- Invalid or duplicate reading positions make the evaluation unavailable.
- All evidence requirements must be satisfied before a claim is marked eligible-for-review.
- eligible-for-review is not an approval and is not production authorization.

## Integrity is not authenticity

SHA-256 digests detect accidental or subsequent changes to a statement and its provenance envelope. They are not signatures, do not prove who authored a claim and do not authenticate a reviewer.

The claim contract remains pending-review. A later review workflow must independently check at least factual accuracy, atomicity (one proposition), completeness, originality, spoiler ceiling and source provenance. Promotion to production must remain a separate, reviewed code change. No reviewer identity is inferred from a string field.

## Copyright boundary

This module stores only original editorial statements and source metadata. It does not store EPUB bytes, extracted passages, chapter text, screenshots or free-form reviewer notes. Tests use synthetic statements and only reference the small set of chapter documents whose hashes were previously verified.

## Current limitations

The currently verified chapter-document allowlist is sparse. A source is usable here only when its exact chapter document has been inspected and registered. The catalogue entry alone does not establish passage access or narrative knowledge.

cosmere.epub was not found in the Library search performed for this run. No new Cosmere passages, summaries or claims have been added. Existing Roshar chapter-1 fingerprints are reused only as structural test fixtures; they are not presented as newly reviewed narrative knowledge.

## Verification

The dedicated workflow runs:

- editorialClaimDrafts.test.ts
- The strict TypeScript boundary check for the claim module and its provenance dependencies.

The production editorial registry remains empty throughout this staging workflow.
