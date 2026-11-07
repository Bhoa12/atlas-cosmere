# Work-scoped spoiler access

World-level progress is not sufficient to authorize a reading position by
itself. Numeric positions are meaningful only inside the declared sequence of
the work that owns them.

`canRevealWorkScopedPosition` therefore requires both scopes to match:

- the requested content world must match the progress world;
- the requested content work must match the progress work;
- all positions must be positive integers inside the declared work range;
- the requested position must be at or behind the validated completed
  position.

The helper is intentionally narrative-free and fail-closed. It stores no book
text, chapter text, titles, summaries or inferred editorial facts. A `true`
result is only a structural permission; narrative content still needs to pass
the separate evidence-backed spoiler gate before it is shown.
