# Cosmere expansion content model

This layer separates reusable application infrastructure from editorial knowledge.

## Data flow

`sources -> works -> reading units -> progress -> content requirements -> visibility`

World records provide stable identifiers for future navigation. A work may reference a world only when that relationship has been explicitly verified; absence of a relationship means **unknown**, not an inferred assignment.

## Source boundary

The catalogue contains only metadata supplied as verified by the user. The verified index of `cosmere.epub` supports the listed work titles. The Roshar package is represented only as declared-private metadata for the two specifically named works. The five principal Roshar novels are not individually named here because their titles were not verified from accessible file content in this implementation.

No EPUB text, quotations, chapter text, or copied summaries belong in this layer.

## Spoiler boundary

Visibility is fail-closed. Content is visible only when a requirement and progress refer to the same work and every required technical reading-unit identifier is completed. The resolver does not decide what constitutes a spoiler and does not infer chapters, chronology, plot events, or world relationships.

## Tests

The test file uses synthetic identifiers and data only. The project currently has no configured test runner; the checks are dependency-free and ready to be wired into a future TypeScript test command.
