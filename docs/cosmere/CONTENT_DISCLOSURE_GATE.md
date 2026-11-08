# Content disclosure gate

`resolveContentDisclosure(...)` combines two independent structural decisions:

1. **Evidence**: the requested metadata or original summary has explicit source-to-work provenance and sufficient declared source access.
2. **Spoiler authorization**: every explicitly required reading unit is known and completed.

The result is fail-closed:

- `available`: both gates allow disclosure.
- `withheld`: evidence is available, but reading prerequisites are incomplete.
- `unavailable`: provenance is structurally valid, but the declared source access is insufficient for the requested evidence kind.
- `blocked`: malformed, ambiguous, or inconsistent input.

The gate stores no EPUB passages or narrative text. It does not infer prerequisites from titles, chronology, worlds, or identifiers, and evidence availability never bypasses spoiler authorization. Conversely, completed reading units never manufacture editorial evidence.

This layer is reusable for Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds because it depends only on explicit identifiers and validated relationships.
