# EXPANSION RUN 88

This iteration adds a cross-entity integrity layer for the Cosmere expansion.

## Model

The reusable model separates sources, worlds, works, explicit world-work links, reading units, progress, and spoiler gates.

The five priority worlds are represented as independent entities: Scadrial, Sel, Nalthis, Taldain, and Roshar. This module deliberately does not infer a work's world from its title.

## Provenance boundary

A verified catalog index can support bibliographic metadata only. Reading units require a source classified as `editorial-accessible` and marked accessible. Private EPUBs that are merely declared are therefore not treated as inspected structure.

The supplied bibliography remains catalog data. No protected passages are copied, and this iteration adds no narrative summaries or editorial claims.

## Validation and spoilers

`validateExpansion` detects orphaned references, duplicate unit identifiers and positions, untrusted reading structure, and invalid spoiler-gate requirements.

Progress is scoped to one work and returned in explicit reading order. Spoiler gates are fail-closed: malformed or unknown requirements cannot unlock content.

The accompanying tests use synthetic data only.