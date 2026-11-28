# Hoid Run 376 — deterministic conversation route arbitration

## Objective

Extract the route precedence that previously lived in the nested HoidScreen conditional chain into a pure, provider-neutral application policy. The router chooses one local capability; it does not authorize narrative evidence, alter progress, or call a provider.

## Route precedence

The planner preserves the existing screen order:

1. Invalid general request when neither magic-system nor character-evolution intent matched.
2. Invalid or incomplete entity dossier.
3. Invalid or incomplete relationship request.
4. Invalid or incomplete entity timeline request.
5. Relationship-mode cue whose exact two-name parser did not resolve a pair.
6. Explicit reread, curated discovery, reading-position and catalogue recommendation routes.
7. Reading-focus selection or scope failure.
8. Relationship, timeline, character-evolution, magic-system and dossier routes, in that order.
9. Invalid general intent.
10. Missing trusted conversation host.
11. Trusted exact-unit conversation.

This order is deliberate. A recognized but incomplete specialist request must not fall through to a broader narrative route. Metadata-only navigation remains available without a narrative host, while narrative dispatch requires both a valid reading focus and a branded trusted host.

## Contract

`resolveHoidConversationRoutePlan(input)` accepts the six existing classifier results, the current reading-focus status and the trusted-conversation capability state.

The input is canonicalized as closed plain data. Accessors, extra properties, unknown statuses, invalid facets/dimensions and malformed entity names are rejected without invoking getters.

The output is one route enum or `unavailable/invalid-input`. It carries no question text, entity aliases, progress snapshot, EPUB locator, evidence ID or provider payload.

## Integration

HoidScreen continues to own user-facing copy and adapter invocation. It now asks the pure planner for one route and uses that route in its existing branches. The planner does not replace the specialized parsers or their progress-bound gateways.

## Safety

- No provider port, network call or provider egress is introduced.
- No classifier can grant narrative authorization.
- Reading-focus gating remains before relationship/timeline/evolution/magic/dossier execution.
- A missing trusted conversation port blocks the generic narrative route.
- Existing adapters remain responsible for their own fresh-progress checks, source provenance and spoiler dependency gates.
- No source EPUB, XHTML, locator, extracted prose or new narrative assertion is added.

## Validation

The dedicated workflow runs route-arbitration tests, existing intent parser regressions and strict TypeScript compilation including HoidScreen. Synthetic classifier results are used; the workflow does not claim that private EPUBs are mounted or inspected.
