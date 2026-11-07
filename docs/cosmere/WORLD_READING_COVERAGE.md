# World Reading Coverage

`hasVerifiedWorldReadingCoverage` is a structural safety boundary between the
bibliographic source catalog, world/work links, and declared reading units.

A world is considered structurally covered only when every linked work has:

- a valid world/work association;
- exactly one valid catalog entry;
- `verified-structure` source status; and
- internally consistent declared reading progress.

The result does **not** establish that an entire book has been read, that every
chapter exists in the input, or that any narrative fact has been verified. A
`cataloged` private source remains insufficient for spoiler-sensitive
unlocks. Missing or ambiguous evidence fails closed.

No EPUB text is stored by this module.
