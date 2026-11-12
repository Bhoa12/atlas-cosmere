# Provenance Contract

## Purpose

Hoid IA distinguishes source provenance from narrative authorization. A source can be present in the private catalogue without making all of its narrative content available to a response.

This contract defines the minimum metadata needed to support original, spoiler-safe summaries and explanations without copying protected text.

## Source records

Each catalogued source should expose stable metadata only:

- source identifier;
- work identifier and display title;
- collection or series membership when known;
- structural positions such as chapter or section identifiers;
- access status for the current environment;
- provenance type, such as private EPUB metadata or locally authored editorial material.

Raw protected passages are not part of this contract.

## Editorial records

A reusable summary or explanation must be represented as an original editorial record with:

- a stable record identifier;
- the work and structural scope it describes;
- an explicit spoiler ceiling;
- provenance pointing to accessible supporting source metadata or verified editorial work;
- a statement of uncertainty when support is incomplete.

Editorial records are treated as untrusted imports at the boundary: oversized records are rejected, and duplicate record identifiers fail closed rather than letting input order choose which text is presented.

The spoiler ceiling is an authorization boundary, not a claim that later material was inspected.

## Access and uncertainty

If a passage or structural detail is unavailable in the environment, Hoid IA must not invent its contents or mark it as consulted. The record may instead state that the detail is unavailable or limit the response to verified metadata and already supported editorial knowledge.

Unknown access status is treated conservatively.

## Presentation rules

Presentation layers may paraphrase accepted editorial records but must preserve their work scope and spoiler ceiling. They must not merge records from different works merely because they share a setting, character, or series.

A response should be able to distinguish:

- verified source metadata;
- original editorial summary backed by available support;
- recommendation based on non-narrative metadata;
- uncertainty or unavailable evidence.

## Required regression cases

Implementations using this contract should test:

- catalogue presence does not imply narrative authorization;
- records from one work cannot authorize another work;
- a record beyond the reader's progress is excluded;
- unavailable passages are not represented as consulted;
- presentation preserves spoiler ceilings;
- provenance metadata alone is never rendered as copied source text.
