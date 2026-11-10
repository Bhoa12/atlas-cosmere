# Spoiler visibility

`resolveSpoilerVisibility` is a fail-closed metadata gate between validated reading progress and any future editorial content.

Each content item declares explicit prerequisite reading-unit identifiers. Visibility is granted only when every prerequisite is known to the validated manifest and explicitly completed.

The resolver does not inspect source text or infer spoiler boundaries from titles, summaries, or narrative knowledge. Requirements must therefore be supplied by a separate, reviewable metadata process. Unknown units, duplicate identifiers, malformed requirements, or unavailable manifest validation block the declared content rather than exposing partial results.
