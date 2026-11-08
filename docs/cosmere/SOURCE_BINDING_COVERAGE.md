# Source binding coverage

`resolveSourceBindingCoverage` audits the relationship between the declared private-source catalog and explicit `sourceId -> workId` bindings.

## Guarantees

- Catalog entries are identified by `id`; bindings refer to those identifiers through `sourceId`.
- A source without a binding is reported as uncovered rather than being matched by title or collection.
- A binding to an unknown source blocks the audit.
- Invalid catalog or provenance registries block the audit.
- Results are deterministic and sorted.
- The result contains identifiers only and carries no EPUB text, chapter text, or narrative facts.

## Intended use

Coverage is a structural readiness check. It does not prove that a source has been read, that a passage is accessible, or that narrative content is safe to reveal. Those decisions remain behind the separate evidence and reading-progress gates.

This keeps Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds on the same reusable provenance model without inferring editorial relationships.
