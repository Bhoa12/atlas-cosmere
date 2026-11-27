# Hoid Run 351 — reviewed narrative temporal partial order

## Objective

Introduce a separate, metadata-only contract for explicit story-time ordering. Run 350 remains a reading-order evidence view. This module does not reinterpret chapter order, publication order, bibliography order or model-generated inference as in-world chronology.

## Contract

- A temporal relation is a closed `precedes` edge from one event entity to another.
- Both endpoints must resolve to verified `HoidKnowledgeKind = event` entries with edition-bound source and unlock metadata.
- Each edge references one already approved `HoidApprovedClaim` with intent `explain` or `context`.
- The claim must identify exactly the two endpoint event IDs and cite both event identities plus at least one independent relation-evidence entry.
- Every evidence entry must have verified provenance and an individually registered chapter source.
- Relation IDs, claim IDs and directed edges must be unique.
- The complete approved relation graph must be acyclic. Cycles, self-edges, duplicate edges, missing endpoints and unsupported claim intents reject the index as a whole.

The existing approved-claim attestation is reused. Its SHA-256 values detect statement/source/review drift; they are not digital signatures and do not authenticate the reviewer.

## Partial-order semantics

`createHoidNarrativeTemporalRelationIndex()` validates and freezes the supplied reviewed snapshot. It does not create, persist, promote or mutate editorial claims.

`getAuthorizedPartialOrder()` filters each edge against the selected book scope and the current reading snapshot. It requires:
1. Both event identities to have passed their first-safe-appearance watermark.
2. Both event evidence records to have passed their full-summary unlock watermark.
3. Every source cited by the relation claim to be unlocked.
4. Every cited source to belong to the selected work scope.

The visible graph is projected into topological layers. Events in the same layer are explicitly marked unordered; layer membership does not imply simultaneity. No total order is invented between incomparable events.

The result is an internal graph projection containing event/claim identifiers and display-safe chapter citations. It is not a React message model. A future conversation presenter must resolve event labels through the existing alias-evidence and dossier boundaries and must not forward internal IDs to UI state.

## Freshness and provider boundary

`createHoidNarrativeTemporalChronologyAdapter()` refreshes the durable cursor before and after building the partial order. If the revision or fingerprint changes, the complete result is discarded. Cancellation is honored before and after the synchronous graph projection.

The module has no provider port, persistence API, progress write, graph mutation, claim promotion, navigation or source-file reader. Provider-bearing adapter configuration and unbranded index objects are rejected.

## Tests

Synthetic fixtures cover:
- valid approved temporal edges;
- deterministic topological layers and incomparable events;
- cycle, self-edge and duplicate rejection;
- event-kind and independent relation-evidence requirements;
- recommendation-claim rejection;
- per-source unlock watermarks and the open-chapter N / completed-through N-1 rule;
- cross-work scope enforcement;
- malformed progress/scope;
- unbranded/provider-bearing configuration;
- stale-progress discard and cancellation.

Tests use original synthetic labels and claims only. No private EPUB/XHTML bytes, protected prose, private paths, source locators or new Cosmere narrative facts are committed.

## Production status

This is an injectable staging contract, not a populated production temporal registry. No real event relation is asserted or promoted by this run. A production chronology still requires independently reviewed original editorial claims, verified event identities, trusted review authorization and host-controlled promotion.
