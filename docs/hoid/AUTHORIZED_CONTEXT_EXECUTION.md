# Hoid IA — Authorized Context Boundary

This module turns a request-scoped knowledge budget into the smallest context that may cross a provider boundary.

## Inputs

- A previously created `RequestKnowledgeBudget`.
- Candidate editorial context items containing an evidence identifier, canonical work identifier, maximum chapter and an original editorial summary.
- Optionally, a requested subset of evidence identifiers.

The module does **not** read EPUB files, retrieve passages or infer new facts.

## Safety properties

1. An item must already be authorized by the request budget.
2. Its work must have a reading position in that budget.
3. Its maximum chapter must not exceed that position.
4. A requested subset is narrowed locally; unknown identifiers are ignored.
5. Duplicate evidence identifiers are emitted once.
6. Malformed or unavailable summaries are excluded.
7. `isContextWithinBudget` revalidates the selected context immediately before a provider call.

A provider adapter receives the resulting context only. It must not receive the complete editorial repository and cannot treat generated text as new evidence.

## Monotonicity

Context construction is intentionally one-way:

`request budget -> optional narrowing -> authorized context`

Later stages may remove context, but they must not recover excluded items or append new evidence. Retries and provider changes reuse the same request budget.

## Copyright and provenance

Context items are expected to contain concise, original editorial summaries backed by permitted metadata or accessible evidence. Protected source passages must not be copied into this boundary. If a passage is unavailable or its provenance cannot be established, it is not represented as an authorized context item.

## Recommended integration tests

- Future-chapter evidence is excluded even when present in candidates.
- Evidence from a work with no reading position is excluded.
- Requested subsets cannot introduce identifiers absent from the budget.
- A modified context fails `isContextWithinBudget`.
- Different reader positions produce different context ceilings from the same candidate set.
