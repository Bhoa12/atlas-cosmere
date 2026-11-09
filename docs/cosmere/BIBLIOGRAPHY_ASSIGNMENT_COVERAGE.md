# Bibliography Assignment Coverage

`resolveBibliographyAssignmentCoverage` reconciles the private bibliography
catalog with explicit source-to-work and source-to-world assignments.

A catalog source is **covered** only when both relationships are declared. The
resolver returns:

- `complete`: every catalog source has both assignments;
- `incomplete`: the input is structurally valid but one or more sources still
  lack a declared relationship;
- `blocked`: assignment integrity failed, so no partial coverage result is
  exposed.

The resolver is intentionally metadata-only. It does not read private EPUBs,
infer worlds or works from titles, establish narrative evidence, change reading
progress, or authorize spoiler disclosure. Missing metadata remains missing until
an explicit, backed declaration is supplied.
