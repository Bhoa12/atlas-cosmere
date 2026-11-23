# Run 266 — Conversation scope capability and CI repair

## Purpose

Repair the Run 265 conversation-scope integration against the actual GitHub Actions results, then make the scope capability stable across gateway validation and follow-up turns.

## Findings from Run 265

The completed workflow runs for commit `aa08bb1d5d8e58e723c22dbd706fdb9c075d8d6e` showed 24 failed workflow runs and 4 successful runs. Failures clustered around three issues:

1. `validateHoidConversationScopeBinding()` reconstructed a new binding object after validating the input. The module's `WeakSet` capability was attached only to the originally issued object, so the reconstructed object could not be reused on the next turn. This broke continuity and caused a later abstention to return a different object identity.
2. Several legacy follow-up tests supplied typed/coreference contexts without the new evidence-bound scope binding. The gateway correctly rejected those requests with `context-scope-unavailable`; fixtures needed to model the new required contract.
3. A relationship-graph fallback still checked `followUp.status === "resolved"` after that branch had already returned. TypeScript correctly narrowed the remaining state to `not-follow-up`, producing TS2367/TS2339 errors.

## Changes

- Validation now returns the exact original binding object after validating its shape, manifest chapters, progress revision and fingerprint. The object is minted by this module, deeply frozen at creation, and retains its `WeakSet` capability across turns.
- Added a regression proving validation preserves reference identity and that the returned binding can be validated again.
- Kept the fail-closed rule: typed, group and coreference follow-ups require an issued, current evidence-bound scope. A typed context alone is not permission to retrieve across works.
- Updated synthetic gateway and progress-race fixtures to carry a binding minted from verified synthetic manifest metadata.
- Added an explicit test that a typed follow-up with typed context but no binding is rejected before provider invocation.
- Removed the unreachable resolved-follow-up branch from the unscoped relationship shortcut. Recognized follow-ups already use the scoped runtime path.
- Added a dedicated workflow for binding identity, gateway routing, typed follow-ups, progress races and strict TypeScript.

## Safety

- No provider receives the binding, prior prose, EPUB text, XHTML, locators or local file handles.
- The binding remains ephemeral and metadata-only.
- Progress revision and fingerprint are revalidated on every turn.
- Missing, stale, altered or mismatched bindings fail closed; there is no automatic cross-work fallback.
- Fixtures are synthetic. No private EPUBs or protected passages are included.

## Validation

The dedicated workflow runs the focused Vitest suites and strict TypeScript checks. The final status is determined by GitHub Actions on this branch's HEAD; no result is claimed before those runs complete.
