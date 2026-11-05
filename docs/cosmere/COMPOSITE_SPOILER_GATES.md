# Composite spoiler gates

Some application content may require more than one explicitly verified reading
checkpoint. This module models that policy without encoding narrative facts.

A composite gate opens only when **every declared requirement** is satisfied by
progress for the matching work. Missing or malformed requirements fail closed.

Requirements are metadata and must be populated from verified reading
structure. The module does not infer dependencies from titles, characters,
worlds, summaries, or private source text. It is therefore reusable across all
Cosmere worlds while keeping editorial knowledge separate from authorization.
