# Run 323 — exact-unit spoiler dependency gate at provider egress

## Purpose

Run 322 introduced a metadata-only, chapter-number dependency contract. This run adds the exact-unit counterpart for the signed exact-claim runtime and connects it before provider selection.

The new module is `src/hoid/exactUnitSpoilerDependencyGate.ts`.

## Contract

For each exact approved claim package, the gate derives three requirements from every evidence policy:

- source unit;
- first-safe-appearance unit;
- unlock unit.

Every requirement retains its evidence ID, semantic role, and edition-bound chapter reference. Multiple requirements in the same work are preserved rather than collapsed to a chapter number or inferred chronology.

The canonical dependency fingerprint commits to the claim ID and all exact references, including work, chapter label, ordinal, unit ID and identity fingerprint.

## Progress semantics

The gate consumes the v3 exact-unit progress ledger:

- An open cursor at ordinal N proves only the contiguous prefix through N-1.
- A requirement at ordinal N is satisfied only when the completed-through ordinal is at least N.
- Explicit whole-work completion is accepted as a reader attestation.
- Progress in one work never satisfies a requirement in another.
- Duplicate visible chapter labels remain supported only through exact unit references.
- Corrupt, stale or unsupported progress fails closed.

## Provider boundary

`HoidExactUnitEvidenceRuntime` now builds and validates the dependency set while canonicalizing each signed claim package. It evaluates the full set against the initial authoritative snapshot before adding that claim to the provider's candidate list.

The provider receives no dependency references, progress positions, chapter ordinals or unlock thresholds. The request fingerprint commits to the eligible claims' dependency fingerprints without exporting those details.

The runtime re-evaluates selected claims against the fresh post-provider snapshot before constructing an answer. Existing per-evidence authorization and presentation-time progress verification remain in place as independent defense in depth.

If all otherwise relevant candidates are withheld by the exact dependency gate, the runtime returns `spoiler-dependency-locked` and does not invoke the selector.

## Provider neutrality

The gate is a pure TypeScript contract over the existing exact-unit progress ledger. It introduces no LLM, database, cryptographic vendor, network or platform dependency.

## Privacy and production boundary

- No EPUB bytes, XHTML body, source passage or private path is read or committed by this change.
- Dependency contracts contain structural references and integrity fingerprints only.
- The provider sees only the question, bounded candidate summaries/IDs and an opaque request fingerprint.
- No production knowledge is added, promoted or written.
- No reading progress is changed.
- Existing signed claim and reviewer trust contracts remain authoritative.

## Validation

The dedicated workflow runs the new gate tests, exact-unit answer-runtime tests, claim-integrity regressions and trusted-host regressions, then performs strict TypeScript checking.

Synthetic tests cover multiple works, multiple prerequisites in one work, exact completion boundaries, explicit work completion, missing work progress, duplicate chapter labels with exact unit IDs, tampered references, malformed objects and corrupt progress.
