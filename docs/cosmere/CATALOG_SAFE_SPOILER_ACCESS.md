# Catalog-safe spoiler access

`resolveCatalogSafeUnlockedGateIds` is the conservative integration point for
anti-spoiler visibility.

Before a gate can unlock, the resolver:

1. checks every declared requirement against a work and reading coordinate in
   the technical catalog;
2. excludes any gate with an unknown work or undeclared coordinate;
3. normalizes progress without adding coordinates;
4. evaluates only the remaining explicit requirements.

This module does not inspect EPUB content, infer chapters, repair identifiers,
or infer narrative dependencies. Missing catalog structure therefore fails
closed: the affected gate remains unavailable until explicit metadata exists.

The same mechanism is world-agnostic and can be used for Scadrial, Sel,
Nalthis, Taldain, Roshar, and future catalog entries.
