# Reading Gate Registry runtime boundary

`readingGateRegistry.ts` is a technical boundary for spoiler-sensitive features.

A gate contains only stable identifiers:

- its own technical identifier;
- the work identifier to which the gate is scoped;
- zero or more required reading-unit identifiers.

The module deliberately stores **no narrative payload, quotations, summaries, chapter text or editorial assertions**.

## Validation policy

Validation is fail-closed for malformed identifiers and duplicate prerequisites. It does not normalize or infer identifiers.

An empty prerequisite list is technically valid: policy layers may use such a gate as an explicit placeholder, but this registry does not decide whether any editorial content should be exposed.

## Integration

Callers must separately verify that:

1. the work exists in the verified source catalogue;
2. required units belong to that work;
3. reader progress is consistent with the same work.

Those responsibilities remain outside this small registry so the architecture can be reused for Scadrial, Sel, Nalthis, Taldain, Roshar and future worlds without encoding unverified editorial relationships.
