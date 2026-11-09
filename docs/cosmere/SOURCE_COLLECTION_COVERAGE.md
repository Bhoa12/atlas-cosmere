# Source Collection Coverage

`resolveSourceCollectionCoverage` compares an explicit list of expected
bibliographic entry identifiers with a validated source catalog.

This is a metadata integrity check only. A `complete` result means every
declared identifier is present in the declared collection; it does **not** mean
that source text was read, narrative facts were verified, summaries exist, or
any spoiler is safe to disclose.

Malformed catalogs, empty collections, and duplicate expected identifiers return
`blocked`. Missing identifiers are reported explicitly as `incomplete`, so
callers can keep expansion work pending without inventing replacement metadata.

This layer is reusable for private EPUB collections and future source formats.
It belongs before reading-unit construction and remains independent from the
anti-spoiler authorization pipeline.
