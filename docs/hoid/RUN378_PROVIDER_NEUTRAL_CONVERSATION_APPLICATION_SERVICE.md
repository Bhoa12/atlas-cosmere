# Hoid Run 378 — provider-neutral conversation application service

## Objective

Introduce an application boundary above the deterministic route planner and typed route executor. The service owns the lifecycle of a single conversational turn without moving UI state, narrative knowledge, storage, EPUB access or provider policy into the application layer.

## Contract

`createHoidConversationApplicationService` receives two ports:

- `readProgress`: returns only the durable progress revision and SHA-256 fingerprint.
- `executeRoute`: receives the closed typed route execution result, an immutable turn context and an optional AbortSignal.

The caller supplies the route input and the progress identity captured when the request was accepted. The service:

1. Canonicalizes the expected progress identity.
2. Reads fresh progress and requires exact revision/fingerprint equality.
3. Resolves the deterministic route through `resolveHoidConversationRouteExecution`.
4. Dispatches only a ready typed route.
5. Checks cancellation and turn ownership after every asynchronous boundary.
6. Reads progress again and discards the handler value if the progress identity changed.

## Turn context

The immutable context contains only schema version, a monotonic in-service turn sequence, selected route and progress identity. It never contains question text, entity aliases, summaries, evidence prose, EPUB locators or provider payloads.

A newer turn supersedes older work. The service also accepts the existing UI session's `isCurrent` capability and AbortSignal; it does not create a second UI session manager.

## Authority boundaries

- The service is provider-neutral and does not select or instantiate a model.
- The route executor remains responsible for calling the correct local/trusted gateway.
- Narrative gateways remain responsible for source-bound claims, exact chapter evidence, spoiler dependencies and their own final progress checks.
- Answer presenters remain responsible for epistemic labels, citations and UI-safe projections.
- The application service does not authorize claims, unlock evidence, mutate progress, persist conversation history or read private EPUB/XHTML bytes.
- A successful service result is not itself proof that arbitrary handler output is safe to render; the caller must still pass it through the established trusted presenter.

## Failure behavior

The service returns stable reason codes for invalid/stale progress, unavailable progress, invalid routes, handler failures, cancellation and superseded turns. It never returns a partial handler value after a failed freshness check.

## Integration status

This run adds the tested application service as an independent composition boundary. The existing HoidScreen route branches are deliberately not moved in this change: they currently own presentation-specific investigation updates and route-specific UI state. A subsequent integration should migrate one route family at a time, beginning with generic trusted conversation, while preserving the existing turn-session and display-projection checks.

## Privacy and fixtures

Tests use synthetic progress identities, a synthetic `tfe` scope and synthetic handler values. No private EPUB, XHTML, chapter text, locator, local path or provider payload is committed.
