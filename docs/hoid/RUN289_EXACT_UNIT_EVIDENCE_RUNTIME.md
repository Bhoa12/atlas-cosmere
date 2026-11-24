# Run 289 — exact-unit evidence answer runtime v2

## Objective

Connect the schema-v2 editorial attestations and cross-work exact-unit authorizer to a complete, provider-neutral answer path. This runtime is parallel to the legacy v1 runtime and does not activate a production authority switch.

## Package boundary

Each `HoidExactClaimPackage` contains:
- one schema-v2 editorially attested claim;
- its original editorial evidence records;
- one exact-unit policy per evidence ID.

Construction revalidates the claim, exact policies, source-body digest, aliases, provenance and summary hashes. Duplicate claim IDs, conflicting evidence IDs or conflicting policies are rejected.

## Answer pipeline

1. Validate the question, intent, depth, entity IDs and optional work scope.
2. Refresh the durable v3 progress snapshot.
3. Deterministically detect a mention of a locked entity alias and withhold the request before provider invocation.
4. Authorize all three references for every evidence item: source, first safe appearance and unlock.
5. Build a request-local candidate set from fully authorized claims only.
6. Send the selector only the question, intent, approved claim text/IDs and bounded selection budget.
7. Invoke the provider through the shared deadline/abort boundary.
8. Refresh progress after asynchronous selection and reject stale work.
9. Validate that every selected claim ID belongs to the request-local candidate set.
10. Reauthorize all selected evidence policies against the fresh snapshot.
11. Reconstruct exact citations locally from the attested policy references.
12. Return a progress freshness receipt that the host must verify immediately before presentation.

## Provider egress

The provider request has no reading snapshot, visible chapter number, ordinal, unit ID, identity fingerprint, source locator, chapter reference or EPUB body. It receives only approved claim candidates and a request fingerprint over the question, intent, depth budget and candidate set.

The provider is a selector, not an author. It returns claim IDs; final prose and citations are reconstructed locally from the attested registry.

## Spoiler invariants

- An open cursor at ordinal N proves only N-1.
- Source, first-safe-appearance and unlock must all be complete.
- Cross-work policies require each referenced unit to be independently complete; no chronology is inferred across books.
- A query that explicitly mentions a locked alias is withheld before provider egress.
- A provider response cannot add claims or evidence IDs.
- Any progress change during provider work invalidates the answer.
- `verifyForPresentation()` rechecks the durable revision, fingerprint and every evidence policy immediately before rendering.

## Scope and explanation depth

The runtime uses the existing deterministic explanation-depth budgets. Work scopes are checked against all works referenced by every selected evidence policy. Comparative depth requires at least one selected claim with evidence prerequisites spanning two or more works.

## Trust and integrity

The progress fingerprint and editorial hashes are consistency/integrity tokens, not signatures or authentication credentials. Reviewer identity still depends on the trusted editorial curation/build process.

## Integration status

This run creates a fully testable exact-unit answer runtime v2. It does not yet replace `HoidConversationGateway`, `HoidScreen`, or the active v2 Atlas progress authority. The UI host must call `verifyForPresentation()` immediately before rendering and must not render a ready result without that check.

The existing v1 runtime and its numeric schema remain untouched. No automatic migration is performed.

## Source handling

The runtime stores only original editorial summaries, metadata and hashes. It does not copy or upload EPUB, XHTML, chapter titles, source passages or full protected text. If a source body has not been individually inspected and fingerprinted, its evidence package cannot be attested.
