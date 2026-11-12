# Spoiler visibility boundary

This module resolves only a technical visibility state from explicit unit identifiers.

It does not contain narrative text, decide which facts are spoilers, infer chapter structure, or infer world membership. A caller must provide verified metadata before creating a gate.

The resolver is fail-closed: malformed content or ambiguous duplicate progress remains locked.

## Integration

Use after the reading-unit and progress layers:

`source metadata -> work -> reading units -> completed units -> visibility gate`

This makes the mechanism reusable for Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds without encoding editorial claims in the runtime.
