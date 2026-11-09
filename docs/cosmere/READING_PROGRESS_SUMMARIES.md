# Reading Progress Summaries

`resolveReadingProgressSummaries` converts explicitly supplied reading units and progress into UI-safe counts.

## Guarantees

- Only declared unit identifiers and positions are used.
- The next unit is the lowest declared position not marked complete.
- Cross-work completions, duplicate unit identifiers, duplicate positions, and duplicate progress records block the complete result.
- The resolver never invents chapters, sections, or other editorial structure.

## Spoiler boundary

A valid summary is only a progress calculation. It does not read private EPUB text, establish narrative evidence, or authorize spoilers. Any content disclosure must continue through the separate evidence and anti-spoiler authorization layers.
