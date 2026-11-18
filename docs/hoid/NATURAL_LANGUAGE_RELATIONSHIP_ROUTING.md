# Natural-language relationship routing

## Purpose

Route explicit questions about relationships between two Cosmere entities to the local, progress-bound knowledge-graph explanation gateway.

Examples of supported intent cues include questions phrased as "relación entre", "cómo se relacionan", "conexión entre" and "qué tienen en común". Cue detection is deterministic and provider-free. It does not resolve identities.

## Entity resolution

The relationship gateway uses the production exact-mention resolver backed by the source-controlled entity and alias registries. It requires exactly two distinct, unambiguous, currently disclosed entities. A known but locked or unreviewed alias blocks the entire request. Unknown names, fuzzy matches and provider-generated IDs cannot create graph nodes.

The mention order in the original question determines the first directed query. A reverse query is attempted only if the first direction has no path. Both searches are bounded to depth four and one path. A truncated explanation is withheld by the presentation boundary.

## Explanation and response boundary

The relationship gateway delegates to the local HoidExplanationGateway, which can only plan from the local authorized graph and render exact approved editorial claims. It performs no provider call.

The presentation adapter then verifies:
- exact claim-to-segment correspondence;
- exact evidence-ID/source correspondence;
- source edition, navigation and document hashes;
- chapter locator identity against the reading manifest;
- every source unlock against the current cursor snapshot;
- bounded, non-truncated output.

The result is converted into the existing HoidEvidenceAnswer contract, so the existing conversation and UI citation boundary remains authoritative.

## Failure policy

Ambiguous, blocked, unknown, stale, malformed, truncated or unsupported relationships produce an opaque unavailable result. The ordinary answer runtime is not used as a fallback for a recognized relationship question. This prevents a language model from inventing a missing edge or bypassing an unavailable graph.

## Current production limitation

The production editorial knowledge, approved-claim and alias registries remain empty pending source inspection and independent editorial review. The new route is therefore integrated but intentionally abstains for real-world entity questions until reviewed records are promoted through the protected workflow. Synthetic fixtures test the successful path without populating production registries.

## Intellectual property

Only metadata, opaque locators, edition hashes and original reviewed claims are used. No EPUB, XHTML body, extracted passage or copied narrative text is committed.
