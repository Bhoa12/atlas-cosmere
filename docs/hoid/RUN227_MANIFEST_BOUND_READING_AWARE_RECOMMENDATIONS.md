# Run 227 — Manifest-bound reading-aware recommendations

## Purpose

The reading-aware recommendation composer is an exported boundary. It must not
trust a plausible-looking `currentChapter` number merely because
`completedThroughChapter === currentChapter - 1`.

A caller can construct a structurally valid-looking context without going
through the authoritative cursor coordinator. Before this run, the composer
checked numeric consistency and catalogue identity, but did not independently
require the current chapter to exist in the exact checked-in edition manifest.

## Change

`composeHoidReadingAwareRecommendations()` now resolves the manifest
for every in-progress work and requires:

1. The work has a ready, edition-bound numbered-chapter manifest.
2. The requested current chapter exists as a manifest unit.
3. The completed-through chapter equals the immediately preceding manifest
   unit; for the first unit it must be `null`.
4. A cursor beyond a partial manifest's verified safe prefix is rejected.

The function still uses the reader's explicit `order` value for
resumption ordering and does not infer canonical Cosmere reading order,
narrative dependencies or plot recommendations.

## Spoiler and evidence boundary

This change validates only reader-position metadata. It does not inspect EPUB
chapter bodies, create editorial summaries, promote claims, or authorize
narrative evidence. `HoidEvidenceRuntime` remains the sole narrative
evidence authorization path.

A manifest proves only the numbered chapter units available for that edition.
It does not prove that the chapter body was accessible or inspected. Source
body verification continues to use the sparse SHA-256 allowlist and approved
claim integrity checks.

## Regression coverage

The recommendation tests now verify:

- an ordinary valid chapter position remains accepted;
- chapter one has no completed predecessor;
- the last chapter of a partial safe prefix remains accepted;
- a numerically plausible chapter after that prefix is rejected;
- inconsistent current/completed chapter boundaries remain rejected.

All test fixtures are synthetic metadata. No private EPUB bytes, XHTML,
chapter text, excerpts or narrative summaries are committed.
