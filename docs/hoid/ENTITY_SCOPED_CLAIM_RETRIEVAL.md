# Entity-Scoped Claim Retrieval

## Purpose

Run 115 connects exact, spoiler-aware entity mention resolution to the strict editorial claim selector. The model remains a selector only: it cannot create claims, add entity associations, write narrative prose, or widen the evidence scope.

## Request flow

1. The conversation gateway validates the authoritative v2 progress snapshot and its revision/fingerprint.
2. Entity mention preflight scans every known alias, including aliases without a disclosure record.
3. A locked, undisclosed, mixed safe/blocked, ambiguous or truncated mention set fails closed before the answer runtime is called.
4. Multiple distinct aliases are accepted only when each normalized spelling maps to one authorized entity. Shared spellings remain ambiguous.
5. The gateway forwards canonical entity IDs with the same progress identity.
6. The cursor evidence facade revalidates the edition-bound snapshot and preserves the entity IDs.
7. The evidence runtime validates every ID against its local knowledge catalog and filters approved claims before invoking the selector.
8. The existing evidence AND check still requires every evidence item of every selected claim to be unlocked.

## Claim contract

Approved claims may declare an optional entityIds array. The array must be dense, bounded, unique, syntactically canonical, and reference only IDs in the validated knowledge catalog.

For an entity-scoped request, a claim is eligible only when its entity scope contains every resolved entity ID. Each scoped entity ID must also appear in that claim's evidence ID set, so an association cannot be declared without corresponding evidence. A claim without entity scope is not eligible for an entity-scoped request. For an unscoped question, existing claims retain their prior behavior.

This makes relationship questions require a claim explicitly associated with all named entities; two unrelated claims about each endpoint are not silently combined into a relationship.

## Provider boundary

The provider receives only candidate claims that have already passed:
- source and document provenance validation;
- chapter-level progress authorization;
- full evidence AND authorization;
- entity-scope matching.

The provider receives no entity alias registry, no hidden aliases, and no authority to broaden the candidate set. It returns candidate IDs only. The runtime renders exact local approved claim text.

## Limits and failure behavior

- Maximum entity IDs per claim and request: 8.
- Duplicate, sparse, accessor-backed, unknown or malformed ID arrays are rejected.
- Resolver results must be bound to the same progress revision and SHA-256 fingerprint as the request.
- Multiple entities sharing one normalized alias remain ambiguous.
- More than eight resolved entities are truncated by preflight and therefore withheld.
- Any resolver or progress failure prevents selector invocation.
- No candidate claim for the complete entity scope produces the existing no-authorized-evidence abstention.

## Editorial status

The production knowledge, approved-claim and alias registries remain empty. No real Cosmere entities or claims are added by this run. Synthetic tests validate the mechanism only.

No EPUB, source passage or protected chapter text is stored in Git. Source-backed claims still require individually inspected documents, original summaries, independent review and explicit promotion.
