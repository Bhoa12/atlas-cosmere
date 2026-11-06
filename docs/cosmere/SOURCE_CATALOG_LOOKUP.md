# Source catalog lookup

This utility provides conservative lookups over the private Cosmere bibliographic manifest.

A lookup succeeds only when an identifier or title resolves to exactly one source whose availability is `declared`. Missing and ambiguous requests return no result.

## Editorial boundary

A successful lookup means only that a bibliographic source is declared in the supplied catalog. It does **not** mean that its EPUB has been opened, that any passage has been inspected, or that narrative facts, chapter structures, world assignments, chronology, or spoiler checkpoints have been verified.

Consumers must keep editorial evidence separate from bibliographic identity and must not unlock content solely because a source can be found in the manifest.
