# Multi-Entity Editorial Relationship Claims

## Purpose

Schema version 2 adds a staging contract for a binary relationship assertion between two entities. It does not change the version-1 atomic claim contract or the production evidence runtime.

A relationship draft contains:

- A directed graph predicate.
- A subject and object entity reference, each with a kind and evidence-index mapping.
- One original atomic statement.
- One or more edition-bound evidence records.
- A subset of evidence indices that directly supports the relationship.
- Statement and full-claim SHA-256 digests.
- A fixed \`pending-review\` state.

## Evidence rules

Every evidence item is validated by the existing version-1 claim validator against the current reading manifest, exact chapter locator, navigation digest and individually inspected chapter-document digest.

All evidence unlock thresholds use logical AND. Every participant must be covered by at least one relation-evidence item. Evidence is required to be in canonical order so that index mappings cannot change silently when the validator normalizes the batch.

The relationship is not eligible for review until every evidence threshold is satisfied by the authoritative cursor snapshot. The open chapter does not count as completed.

## Review packets and receipts

Relationship review packets contain only original editorial prose, entity IDs, predicate, source metadata, locators, digests and an unchecked checklist. They never contain EPUB bytes or source passages.

The checklist separately evaluates:

1. Factual accuracy.
2. Relationship accuracy.
3. Entity identity.
4. Completeness.
5. Originality.
6. Spoiler ceiling.
7. Provenance.

An approved receipt requires all seven checks and the closed note code \`no-issues\`. Revision and rejection use closed issue codes; free-form notes are rejected to prevent source passages from entering review metadata.

A valid approval returns \`approved-awaiting-source-promotion\` with \`promotionAllowed: false\`. The receipt does not authenticate reviewer identity by itself and does not modify the production registry. Reviewer identity and independence must be established by protected repository review and permissions.

## Current staged examples

Three source-backed relationship drafts are staged from Roshar chapter-three documents. Their entity identifiers are references for review only. They do not create production entities, aliases or graph edges.

All three require chapter 4 completion before becoming eligible for review. The production editorial registry remains empty.

## Validation

The relationship workflow runs:

\`\`\`sh
npx vitest run src/hoid/editorialRelationshipDrafts.test.ts src/hoid/editorialClaimDrafts.test.ts src/hoid/editorialDrafts.test.ts src/hoid/editorialReviewPackets.test.ts src/hoid/verifiedChapterDocuments.test.ts
npx tsc --noEmit --strict --target ES2020 --module commonjs --moduleResolution node --skipLibCheck src/hoid/editorialRelationshipDrafts.ts src/hoid/editorialClaimDrafts.ts src/hoid/editorialDrafts.ts src/hoid/evidenceRuntime.ts src/hoid/knowledgeGraph.ts src/hoid/verifiedChapterDocuments.ts
\`\`\`

## Promotion boundary

Staging relationship claims are never passed to the provider selector. Promotion requires a separate source-controlled change that adds reviewed entity records and approved claims to the production registries, followed by the existing graph, alias, evidence and spoiler tests.
