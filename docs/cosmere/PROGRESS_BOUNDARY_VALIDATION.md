# Progress boundary validation

This module validates reader progress against reading-unit coordinates explicitly declared in the technical catalog.

It detects unknown works, invalid negative coordinates, and progress beyond the highest declared coordinate.

The validator is intentionally conservative: it does not fill missing units, infer chapter counts, inspect EPUB text, or transform an out-of-range coordinate into a valid checkpoint. A catalog with incomplete structure therefore cannot unlock additional content merely because progress data exists.

This is reusable across Scadrial, Sel, Nalthis, Taldain, Roshar, and future worlds because it operates only on stable IDs and declared reading metadata.
