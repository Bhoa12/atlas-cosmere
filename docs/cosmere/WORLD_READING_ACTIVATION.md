# World reading activation

`resolveWorldReadingActivation` is a structural boundary between an approved
world-expansion step and later reading features.

A world becomes `activated` only when two independent conditions are explicit:

1. its execution-gate entry is executable; and
2. `coverageByWorldId` contains the exact value `true`.

Missing coverage never grants access. A non-executable world remains inactive
even if coverage is present. Unknown coverage keys, duplicate world identifiers,
or malformed gate metadata block the entire result.

This layer carries only identifiers and boolean state. It does **not** read EPUB
text, create summaries, verify narrative facts, infer chapters, or authorize
spoiler-bearing content. A reading-ready result is therefore a technical signal
for subsequent structural work, not evidence that private source passages were
consulted or that editorial content is safe to display.
