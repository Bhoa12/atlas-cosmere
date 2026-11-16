# Reading snapshot security

## Authorization invariant

A reading snapshot is an authorization input, not a best-effort UI payload. The validator accepts only plain records with the exact supported keys and one unambiguous position form:

- { bookId, chapter, order? }
- { bookId, completed: true, order? }

A position that contains both chapter and completed is invalid. Completion is a privileged state because it authorizes all evidence in that work; it must never be inferred from, or combined with, a chapter value.

## Fail-closed behavior

The entire snapshot is rejected when any entry is malformed. The validator does not drop malformed entries and continue with the remainder. This avoids partial normalization in which a contradictory or malformed record can be silently converted into a broader authorization state.

The validator also rejects:

- non-plain objects, arrays, and inherited position fields;
- unknown keys;
- missing or non-canonical book IDs;
- duplicate work IDs;
- non-literal completion values such as false or "true";
- missing positions, invalid chapter numbers, or invalid ordering metadata;
- payloads larger than the configured maximum.

Edition-specific chapter bounds are checked by validEditionBoundReadingPositions() after this structural boundary. Unknown but structurally valid work IDs remain outside the declared bibliography and cannot authorize known works.

## Runtime coverage

HoidEvidenceRuntime.answer() and .recommend() both use the same edition-bound validator. A malformed or contradictory snapshot is rejected before a selector is called and before recommendations are produced.

The regression suite includes synthetic attempts to combine an early chapter with completed: true. Both answer and recommendation paths must fail closed.

## Scope

This policy validates progress metadata only. It does not inspect, copy, or upload EPUB text and does not claim that an unavailable passage has been consulted.
