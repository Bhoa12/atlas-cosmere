# Content evidence gate

`contentEvidenceGate` separates bibliographic availability from permission to
claim narrative support.

A content item must name its `contentId`, `workId`, `sourceId`, and an
explicit evidence kind. The source must exist in the validated catalog and be
explicitly bound to that work.

- `metadata` may use a cataloged source.
- `original-summary` requires a source marked `verified-structure`.

The gate stores no source passage and does not turn private EPUB ownership into
evidence that narrative text was read. It does not authorize spoilers by itself;
spoiler authorization remains a separate progress-based policy.

Missing provenance, duplicate source bindings, unknown identifiers, or malformed
records are blocked rather than inferred from titles, world names, chronology,
or collection order.
