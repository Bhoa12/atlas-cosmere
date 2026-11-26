# Run 322 — chapter 23 evidence and cross-work spoiler dependency gate

## Scope

Run 322 advances two connected boundaries:

1. Add one source-verified chapter document and original Spanish editorial summary from the currently accessible Roshar omnibus.
2. Add a provider-neutral prerequisite contract for explanations that combine knowledge from more than one Cosmere work.

The change is isolated on `feat/hoid-ia-core-run322`, based on `feat/hoid-ia-core-run321`. It does not modify `main`, prior branches or production registries.

## Chapter 23 source verification

The current Library EPUB inventory was filtered to EPUB files and returned the Roshar omnibus, Danzante del Filo and Esquirla del amanecer (each with a duplicate copy). The Roshar omnibus was materialized only into the temporary working container for this inspection.

The omnibus OPF and navigation fingerprints match the existing edition metadata:

- OPF SHA-256: `6eae99f8feccc93a57685108f0f8a8d6af68b7f1858eee63efcf710839cb7477`.
- Navigation SHA-256: `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025`.
- Chapter 23 TOC ordinal: 34.
- Chapter 23 spine ordinal: 50.
- Edition-bound locator: `nav:roshar-omnibus-v1:08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025:L1-045.xhtml`.
- Raw XHTML SHA-256: `cbf8cc5fd1bfe5ef8d4d614bed5e9419f1f6ad94013aaa9e8c5bec8ce2a2b64a`.

The chapter body was read in memory to prepare an original editorial paraphrase and was not copied to the repository. No EPUB, XHTML, chapter title, extracted passage, image or private source path is committed. The temporary materialized copy is not part of the repository.

## Editorial draft

- ID: `twok.chapter-023.kaladin-roca-teft-matopomo-and-bridge-four-bond`.
- Source: `twok`, chapter 23.
- Source document digest: the exact raw XHTML digest above.
- Summary digest: `cd46838d190f810cebec4a90575e6c681defe13fc5d4ce723e2b27ce4fed6833`.
- Review status: `pending-review`.
- Evidence unlock watermark: chapter 23 completed-through.

The summary remains withheld until chapter 23 is completed (equivalent to opening chapter 24). It is a source-backed original paraphrase, not a transcription. It is not added to the production evidence registry and cannot authorize an answer.

## Cross-work spoiler dependency contract

`src/hoid/spoilerDependencyGate.ts` introduces:

- `buildHoidSpoilerDependencySet()`
- `validateHoidSpoilerDependencySet()`
- `evaluateHoidSpoilerDependencies()`

A dependency set must contain at least two distinct works. Each prerequisite names a known work and a minimum completed-through chapter. The builder resolves every chapter against the current edition manifest and rejects ambiguous chapter labels instead of selecting a locator arbitrarily.

The fingerprint is deterministic and covers the dependency-set ID plus sorted work/chapter requirements. Validation rebuilds the contract before evaluating progress.

Evaluation uses `validEditionBoundReadingPositions()` and requires every work's own watermark to meet its prerequisite. It never borrows progress from another book or infers completion from array order. Missing requirements return a generic withheld result with only a missing-count; malformed or contradictory progress fails closed.

The module is provider-neutral and pure. It does not call an LLM/provider, promote knowledge, mutate progress, or write production state. It is a new gate contract for the cross-work explanation planner; application wiring remains a later step and `App.tsx` stays fail-closed.

## Coverage after Run 322

- Bibliography: 24 works (17 Cosmere, seven Roshar), unchanged.
- Individually inspected chapter documents: 73 across four works.
- Staged original summaries: 69, all pending review.
- Editorial bundle: 87 records (69 summaries, one atomic claim, 14 entity dossiers, three relationships).
- Production knowledge entries: zero.
- Approved claims: zero.

The current Library EPUB filter does not return `cosmere.epub`. Its 17 works remain in the fixed catalogue, but this run makes no new Cosmere chapter-inspection claim.

## Validation and safety

The dedicated workflow runs the new dependency-gate tests together with chapter-document, editorial-draft, source-coverage, ingestion-plan and review-bundle regressions, plus strict TypeScript checks.

The new gate rejects:

- fewer than two distinct works;
- unknown work IDs;
- invalid or out-of-range chapter watermarks;
- duplicate work requirements;
- ambiguous chapter numbers;
- altered dependency fingerprints;
- accessor-backed or malformed objects;
- duplicate/contradictory reading positions;
- progress beyond an edition's verified chapter range.

No production activation receipt, reviewer key, trusted-host root, approval or automatic merge is created by this run.
