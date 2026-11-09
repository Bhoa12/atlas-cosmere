# World expansion execution gate

resolveWorldExpansionExecutionGate is a technical boundary between an already
validated structural expansion plan and any later execution step.

## Inputs

The gate accepts:

- structural actions for worlds;
- explicit boolean approvals.

Only an expand-structure action with an explicit matching approval can become
executable. Worlds awaiting catalog coverage or already blocked remain
non-executable regardless of approval data.

## Fail-closed behavior

The entire result is blocked when action identifiers or approval identifiers are
duplicated, empty, malformed, or when an approval references a world absent from
the action plan.

## Editorial boundary

This module does not inspect private EPUB text and does not carry excerpts,
summaries, narrative facts, or spoiler-bearing payloads. An executable result
means only that a structural step is permitted by explicit metadata; it does not
prove that a source was read or that editorial content has been verified.

The intended pipeline is:

catalog → explicit world coverage → readiness → ordered structural plan →
execution gate → reading/progress/spoiler layers.
