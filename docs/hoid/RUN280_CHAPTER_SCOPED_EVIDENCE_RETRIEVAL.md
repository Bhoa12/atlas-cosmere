# Run 280 — Chapter-scoped evidence retrieval

## Purpose

Run 279 preserved exact chapter identity in a private conversation sidecar. Run 280 makes that context operational: a validated follow-up binding now constrains local evidence retrieval to the exact source chapters cited by the preceding authorized answer.

The scope is a retrieval filter, not a progress cursor or an editorial grant.

## Flow

1. The conversation gateway validates the existing HoidConversationScopeBinding against the live cursor snapshot.
2. The binding validation returns its module-private, edition-bound chapterReferences.
3. The gateway forwards those references only to the cursor-native runtime as chapterScope.
4. The cursor facade forwards the local metadata to HoidEvidenceRuntime. Exact, already-reauthorized entity IDs may also restore catalog entries for pronoun-only follow-ups.
5. The evidence runtime validates every reference again, verifies that every work in the active book scope is represented, and filters authorized evidence by exact source book/chapter.
6. Existing evidenceUnlock, first-safe-appearance, claim-attestation, scope, and progress checks still run independently.
7. The provider selector receives only the already-filtered approved claim candidates. It never receives chapter references, unit IDs, fingerprints, EPUB locators, or navigation hashes.

## Fail-closed behavior

- Missing or malformed chapter scope is rejected when the field is present.
- Stale edition fingerprints, duplicate references, ambiguous labels, references outside the active book scope, and incomplete cross-work anchors are rejected.
- A follow-up cannot silently widen from the cited chapter set to every chapter in the same book.
- If the prior chapter anchors do not contain enough approved evidence for the new question, Hoid abstains instead of falling back to unrestricted retrieval.
- The current progress and evidence-unlock gates remain authoritative. A chapter reference cannot unlock its own source or any later material.

## Provider neutrality and privacy

chapterScope is consumed before createHoidClaimSelectionRequest(). The selector protocol remains unchanged and provider-neutral. Only candidate claim IDs, locally approved claim text and evidence IDs cross that boundary; exact chapter references remain in-process metadata.

No EPUB body, chapter title, protected passage, or new narrative summary is added.

## Validation

The dedicated workflow runs chapter-scope canonicalization, evidence runtime, cursor facade, and conversation gateway tests, followed by strict TypeScript checking.

All fixtures are synthetic metadata and original test prose.
