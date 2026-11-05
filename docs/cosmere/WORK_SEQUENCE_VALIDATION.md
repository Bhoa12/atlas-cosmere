# Work sequence validation

`validateWorkSequences` validates only the sequence coordinates explicitly
declared in the technical catalog.

## What it checks

- Sequence values must be positive integers.
- Two works in the same declared world cannot share a sequence value.

## What it deliberately does not do

This validator does not infer publication order, reading order, chronology,
series membership, missing works, or narrative relationships. A gap in sequence
numbers is not an error because the available source catalog may be partial.

The layer operates only on metadata and never reads, stores, or reproduces
protected book text.
