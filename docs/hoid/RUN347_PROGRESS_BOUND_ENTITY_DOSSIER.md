# Hoid Run 347 — progress-bound entity dossier

## Purpose

Add a read-only, provider-neutral entity dossier projection over Hoid's existing source-controlled production registries. The module does not introduce another entity schema, claim registry, graph, review queue, or promotion path.

The projection is deliberately separate from editorial staging. Pending local summaries and entity drafts are not accepted as dossier content. Only the existing production knowledge entries, approved claim attestations, and approved alias-disclosure records are eligible.

## Data flow

1. Validate the exact query and cursor-native progress snapshot.
2. Resolve one exact entity alias through the existing entity resolver. Unknown and locked aliases both return the same not-found shape; ambiguous aliases return an opaque ambiguous result.
3. Require the entity's first-safe appearance, complete summary watermark, and every alias-disclosure evidence item to be unlocked.
4. Validate the knowledge and approved-claim collections with the existing catalog and evidence-runtime contracts.
5. Scan the complete entity summary and each candidate claim against every catalogued alias. A locked or unreviewed alias, an ambiguous spelling, or a named entity absent from the claim's participant metadata withholds that content.
6. Include a claim only when it explicitly references the resolved entity, every claim evidence item is verified and unlocked, and every entity ID named by that claim independently resolves with its own unlocked alias evidence.
7. Return original editorial summaries and approved claim statements with chapter-level citations. Sort deterministically and enforce fixed dossier budgets.
7. The gateway reads authoritative progress before and after construction. A revision or fingerprint change discards the complete result.

## Spoiler semantics

- Cursor chapter N means N is open; only chapters through N-1 are complete.
- Entity-name disclosure, alias disclosure, complete-summary disclosure, claim evidence, and participant identities are separate gates.
- All evidence attached to one claim is mandatory (AND semantics).
- Summary and claim prose are scanned against all catalogued aliases, including aliases without an approved disclosure record.
- A locked, unreviewed, or ambiguous alias in summary/claim prose withholds the affected dossier or claim.
- Every named entity in a claim must appear in its participant metadata.
- A claim mentioning multiple entities is withheld until every participant identity and every evidence source is safe.
- Locked aliases and unknown aliases are indistinguishable.
- Ambiguous aliases do not produce a partial dossier.
- No locked-record counts, hidden aliases, future participant IDs, or pending-claim counts are returned.

## Provider and persistence boundary

The dossier gateway has no provider port and rejects configuration objects containing extra properties such as a provider. It does not call an LLM, persist data, mutate reading progress, promote editorial material, write the production graph, or authorize spoilers.

The returned summary and claim text are original editorial material from the approved local registries. No EPUB bytes, XHTML, passages, local paths, archive locators, or raw source text are copied into the dossier.

## Production availability

The production factory is bound to:

- HOID_EDITORIAL_KNOWLEDGE
- HOID_APPROVED_CLAIMS
- HOID_ENTITY_ALIAS_EVIDENCE

Those registries remain empty until their existing independent review and trusted promotion process succeeds. Consequently, the production dossier gateway currently returns not-found for every entity. This is intentional fail-closed behaviour, not a claim that the bibliography or source files are unavailable.

Tests use synthetic, source-digest-backed fixtures only to exercise contracts. They do not assert new narrative facts and do not add EPUB prose or editorial summaries to production.

## Bounds

- At most 512 knowledge entries and 512 approved claims are validated.
- At most 24 visible claims and 64 evidence citations are returned.
- At most 4 entity participants may be attached to one claim, matching the existing ID-only disclosure resolver contract.
- Exceeding a dossier budget withholds the whole dossier rather than silently truncating dependent information.

## Validation

The dedicated workflow runs the new dossier suite plus the entity resolver, approved-claim integrity, evidence runtime, and knowledge graph regression suites, followed by strict TypeScript checking.

The projection reuses entityResolver, HoidKnowledgeCatalog, evidenceScope, approvedClaimIntegrity, evidenceRuntime, and the cursor progress fingerprint. The authorized graph remains the only graph implementation.
