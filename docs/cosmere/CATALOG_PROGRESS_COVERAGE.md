# Catalog progress coverage

`summarizeCatalogProgress` provides a reusable, catalog-backed view of reading progress.

For each declared work it reports:

- the number of distinct declared reading coordinates;
- how many completed coordinates remain valid after catalog constraint;
- the earliest declared coordinate that is not completed, when one exists.

The function deliberately reuses `constrainProgressToCatalog` before computing coverage. Unknown works and undeclared coordinates therefore cannot affect completion counts or produce a next checkpoint.

## Editorial safety

This utility is purely structural. It does not inspect EPUB text, create chapters, fill numerical gaps, infer a reading order, or claim that a coordinate corresponds to a particular editorial chapter. A work with no declared units remains represented with zero coverage and no next position.

This makes the utility suitable for incremental catalog expansion across Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds while source-backed reading structures are added progressively.
