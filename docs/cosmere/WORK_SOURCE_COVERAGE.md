# Work Source Coverage

`resolveWorkSourceCoverage` reports which cataloged source identifiers are
explicitly bound to each reading-model work identifier.

This is provenance metadata only. It does not establish that a source was read,
that a passage is available, or that any narrative content may be revealed.

The resolver is fail-closed for an empty or structurally ambiguous catalog,
duplicate source bindings, empty identifiers, and bindings to unknown sources.
It never derives relationships from titles, collection order, or narrative
metadata.
