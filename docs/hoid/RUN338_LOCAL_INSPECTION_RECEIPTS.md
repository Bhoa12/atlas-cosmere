# Hoid Run 338 — device-local source inspection receipts

## Objective

Preserve the result of an explicit local EPUB chapter inspection across app sessions without copying source content, confusing inspection with editorial review, or changing reading progress and spoiler authorization.

## Data contract

`HoidSourceInspectionReceipt` is a versioned, metadata-only record containing:

- bibliography work ID;
- exact edition ID and navigation digest;
- numeric chapter identity;
- inspected document byte length and SHA-256 digest;
- canonical inspection timestamp;
- receipt fingerprint;
- explicit `candidate-only` status and no-effect flags.

It deliberately excludes source text, XHTML, EPUB bytes, display filename, local URI, archive path, navigation locator, package source fingerprint, provider payload, conversation text and summary prose.

The ledger is device-local and uses a monotonic revision plus a canonical SHA-256 fingerprint. SQLite compare-and-swap runs inside an exclusive transaction on Atlas's existing shared `atlas-cosmere-hoid.db` connection. The adapter enforces strict append-only evolution: a caller cannot replace, delete or mutate a previously stored receipt through a valid-looking next revision. No second connection is opened.

## UI behavior

`HoidEpubImportPanel` now:

1. Loads the local receipt ledger when the panel mounts.
2. Inspects a chapter only after the user has selected a local EPUB, work and registered edition.
3. Persists only the candidate's safe metadata after the local inspection returns.
4. Shows the count of local receipts separately from the checked-in source coverage report.
5. Prevents repeating the same current chapter task once a receipt exists.
6. Preserves the candidate-only state if local persistence is unavailable.

A different digest for the same work, edition and chapter is a receipt conflict. The previous receipt is preserved; it is never silently overwritten. A concurrent compare-and-swap race is reported separately and reloads the persisted ledger before the UI decides whether the chapter is already recorded.

## Deliberate separation from production

A local receipt is not a signed source attestation, editorial approval, knowledge entry, approved claim, reading-progress event, or spoiler unlock.

Local receipts do **not** feed `getHoidSourceCoverageReport()`, `verifiedChapterDocuments.ts`, the trusted answer host, or the production evidence runtime. The current static ingestion plan remains blocked on the same chapter until a separate editorial review explicitly checks the source and promotes an approved document fingerprint through the reviewed repository path.

The receipt ledger cannot create summaries. It cannot authorize or expose narrative information. The existing trusted exact-unit answer host remains the only narrative authorization boundary.

## Failure handling

- Missing native SQLite support (including web) leaves the receipt store unavailable; inspection remains candidate-only and the UI reports that it was not persisted.
- Corrupt JSON, unknown schema versions and invalid fingerprints are unavailable, never reset to an empty ledger.
- Stale compare-and-swap revisions return a conflict.
- SQLite busy/locked errors are retryable conflicts.
- A changed digest for an existing chapter preserves the earlier record and reports a conflict.
- A failed persistence operation does not modify progress or production knowledge.

## Validation

The dedicated workflow runs the pure receipt/ledger tests, the SQLite adapter tests, the existing source-coverage audit and strict TypeScript checking for the receipt adapters and HoidScreen import panel.

No private EPUB bytes or protected passages are committed by this run.