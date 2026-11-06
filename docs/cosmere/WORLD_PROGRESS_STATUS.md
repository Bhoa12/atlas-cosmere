# World progress status

`resolveWorldProgressStatus` turns catalog-backed world coverage into a small
set of UI states without adding editorial knowledge.

## States

- `blocked`: the world has ambiguous work identifiers or no declared reading
  coordinates.
- `not-started`: declared coordinates exist and none are completed.
- `in-progress`: some, but not all, declared coordinates are completed.
- `complete`: every declared coordinate is completed and the coverage exposes
  no next position.

The helper is intentionally derived from `WorldProgressCoverage`. It does not
inspect EPUB text, infer chapter counts, or claim that a work has been read.
Ambiguity fails closed so a UI cannot present uncertain catalog data as trusted
reading progress.

This makes the status reusable for Scadrial, Sel, Nalthis, Taldain and future
worlds while keeping reading structure separate from narrative content.
