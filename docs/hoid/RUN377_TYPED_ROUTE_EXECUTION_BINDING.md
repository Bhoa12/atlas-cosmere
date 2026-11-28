# Hoid Run 377 — typed route execution binding

## Objective

Bind the pure route plan from Run 376 to the exact discriminated inputs required by the selected handler. This removes repeated reads of unrelated classifier unions from HoidScreen and makes the scope/intent relationship explicit at the application boundary.

## Contract

`resolveHoidConversationRouteExecution(input)` accepts the six existing classifier results, the complete reading-focus resolution and the trusted-host capability state.

It reuses `resolveHoidConversationRoutePlan` as the sole precedence policy. The execution result is a closed discriminated union:

- Relationship and timeline routes carry their exact ready parser result and a canonical `HoidAnswerBookScope`.
- Character-evolution and magic-system routes carry only their recognized ready/incomplete/invalid parser result and a canonical scope.
- Dossier routes carry only a ready exact-name result and a canonical scope.
- Generic conversation carries a ready intent and a canonical scope.
- Scope-selection and scope-unavailable routes carry the corresponding typed resolution.
- Metadata-only routes carry no narrative scope or entity payload.

The executor does not call handlers, providers, storage, EPUB adapters or network services. It binds typed data only.

## Fail-closed behavior

- Invalid root objects, accessors and extra keys are rejected without invoking getters.
- Scope records are canonicalized; invalid source IDs or malformed scope records are rejected.
- Invalid route plans are unavailable.
- A route whose required discriminated input is inconsistent is unavailable.
- Generic conversation still requires a trusted host.
- Metadata-only progress/catalogue routes retain their explicit precedence and do not require a narrative host.
- The executor cannot authorize claims, unlock evidence or alter reading progress.

## HoidScreen integration

HoidScreen now consumes the typed execution union. Each narrative branch receives the narrowed intent and canonical scope from that union instead of re-reading independent classifier unions. This preserves the existing adapters and presentation copy while restoring strict TypeScript narrowing.

## Privacy and spoiler boundary

The execution object contains no question text, EPUB bytes, XHTML, locators, evidence text or provider payload. Narrative adapters continue to revalidate live progress, signed editorial evidence and spoiler dependencies immediately before returning a response.

## Validation

The dedicated workflow runs route-plan, route-execution and classifier regression suites, followed by strict TypeScript compilation of the contracts and HoidScreen. Fixtures are synthetic; no private EPUB content is read or uploaded.
