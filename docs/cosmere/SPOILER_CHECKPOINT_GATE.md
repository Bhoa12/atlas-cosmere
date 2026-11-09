# Spoiler checkpoint gate

`resolveSpoilerCheckpointGate` evaluates whether content may pass a structural reading checkpoint that depends on one or more explicitly declared reading units.

## Contract

Each requirement contains a content identifier, a work identifier, and a non-empty set of required unit identifiers. Content is allowed only when every required unit:

1. exists in the supplied reading structure;
2. belongs to the declared work; and
3. is explicitly completed in progress for that same work.

Malformed identifiers, duplicate requirements, duplicate required units, unknown units, cross-work references, or invalid progress block the entire batch. The resolver is deliberately fail-closed.

## Editorial boundary

This module carries no narrative text and does not infer chapters, events, chronology, summaries, or world facts. A successful decision is only a structural signal for a higher-level anti-spoiler policy; it does not establish narrative evidence or authorize unsupported editorial claims.

The same contract can be reused for works from Scadrial, Sel, Nalthis, Taldain, Roshar, or future worlds because it depends only on explicit identifiers and reading structure.
