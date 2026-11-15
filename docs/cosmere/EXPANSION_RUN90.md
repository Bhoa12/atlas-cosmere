# Cosmere expansion — run 90

This iteration adds a provenance-aware catalog audit for Atlas del Cosmere.

## Purpose

The projection separates bibliographic metadata from narrative content:

- a verified index may support catalog metadata;
- a declared private source is recorded without claiming inspection;
- an original summary requires an accessible editorial source.

The audit is conservative. Duplicate work identities and works with unknown sources are rejected. Descriptors attached to rejected works or unsupported sources remain hidden.

## Scope

The module is world-agnostic and can be reused for Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds. It does not assign works to worlds, infer chronology, invent reading units, or store protected text.

The supplied bibliography remains a source catalog. Any future editorial structure or original summary must be introduced only when its supporting material is genuinely accessible in the execution environment.
