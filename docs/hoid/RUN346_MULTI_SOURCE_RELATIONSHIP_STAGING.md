# Hoid Run 346 — local multi-source relationship bridge

## Purpose

Run 345 stages a source-bound atomic assertion from two or more independently reviewed chapter packets. The repository already has a separate relationship-draft contract, entity identity dossiers, relationship review packets and a cursor-aware relationship evaluator. This run connects those existing contracts without introducing a second relationship schema.

## Pipeline

1. Validate two to eight local source-review packets through the Run 345 multi-source claim bridge.
2. Require at least two distinct works and exact edition/navigation/document evidence for every source chapter.
3. Validate the subject and object as existing editorial entity drafts.
4. Require both entity identities to be resolved.
5. Require every entity-dossier evidence item to be present in the exact relationship source set. Evidence is matched by the full tuple: work, chapter, locator, unlock, edition, navigation digest and document digest.
6. Build a relationship draft using the canonical evidence order produced by the atomic-claim contract.
7. Mark every source evidence index as mandatory relation evidence and build the existing independent relationship review packet.

The relationship draft ID is derived from the canonical multi-source atomic claim ID. Candidate identity is bound to the source candidate, both entity draft digests, the relationship digest and the review-packet ID.

## Spoiler boundary

The bridge does not authorize disclosure. It stages a relationship draft whose every source chapter is a mandatory AND requirement. The existing relationship evaluator delegates to the cursor-native claim evaluator, which projects an open chapter N to completed-through N-1. A relation remains withheld until every source chapter threshold is satisfied.

The bridge itself does not mutate progress, expose a provider-context API, call an AI provider, write production registries, or publish a graph edge. A downstream relationship review and the existing protected promotion process remain mandatory.

## Trust and content boundary

Local reviewer labels remain unauthenticated. SHA-256 digests detect mutation; they are not signatures and do not establish reviewer identity.

The result contains the original relationship statement authored for review and source metadata/digests. It does not contain source summaries, EPUB bytes, XHTML, passages, or local file paths. No source text is persisted or sent to a provider.

The bridge rejects unresolved entity identities and any entity dossier whose supporting evidence is not included in the exact source set. It does not infer entity identities, create aliases, or invent narrative relationships.

## Failure policy

Malformed records, accessors, extra properties, unresolved participants, evidence outside the source set, non-approved local source reviews, duplicate/self participants, invalid predicates, unverified chapter documents and one-work-only source sets are rejected. No partial relationship draft is returned.

## Validation

The dedicated workflow runs the new relationship bridge tests plus the existing multi-source atomic bridge, relationship draft, entity draft, atomic claim and review-packet suites, followed by strict TypeScript checking.

Fixtures use synthetic statements and previously registered chapter digests only to validate contracts and progress gating. They do not assert that new narrative passages were inspected in this run and do not add protected source text.
