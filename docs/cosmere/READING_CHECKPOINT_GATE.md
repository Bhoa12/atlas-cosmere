# Reading checkpoint gate

This domain layer converts explicitly declared reading structure into a narrow,
non-narrative checkpoint decision.

## Inputs

- reading units with stable identifiers, work identifiers and verified positions;
- explicit per-work completion records;
- explicit content-to-required-unit requirements.

## Guarantees

A requirement is allowed only when the required unit exists, belongs to the same
declared work and is explicitly completed for that work.

The resolver is fail-closed: duplicate identifiers, invalid progress, unknown
units or cross-work relationships block the complete batch.

## Editorial boundary

This layer does not read EPUB text, infer chapters, generate summaries or decide
whether a narrative claim is true. A valid checkpoint is only structural input
for a higher-level anti-spoiler policy; it is not evidence and does not by itself
authorize disclosure.
