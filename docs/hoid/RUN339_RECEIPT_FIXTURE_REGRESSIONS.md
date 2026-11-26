# Hoid Run 339 — source inspection receipt regression fixtures

## Objective

Repair the two failing Run 338 receipt-contract tests without changing the production receipt schema, SQLite ledger, ingestion plan, spoiler authorization, or local EPUB handling.

## Findings from Run 338 CI

The failed test job reported two fixture defects:

1. The stale-task test changed `chapterNumber` but retained the old `minimumReaderChapter`. The candidate therefore violated the structural invariant `minimumReaderChapter === chapterNumber + 1` before task lookup, so `invalid-candidate` was the correct result. The fixture now changes both fields, making it structurally valid but absent from the current ingestion plan; the expected result is then `stale-task`.
2. The idempotence test spread a new `inspectedAt` value onto an already fingerprinted receipt. That invalidated `receiptFingerprint`. The test now recreates the receipt through `createHoidSourceInspectionReceiptFromCandidate()` with the new timestamp, preserving a valid fingerprint while exercising same-document idempotence.

A separate regression now verifies that a mismatched reader threshold is rejected as `invalid-candidate`.

## Scope and safety

- Only test fixtures and this document change in Run 339.
- No production runtime or database behavior is altered.
- No EPUB bytes, XHTML, passages, locators, local paths, or private filenames are copied or committed.
- The receipt remains device-local, metadata-only and candidate-only.
- A local receipt does not create a summary, approve evidence, alter reading progress, or unlock a spoiler.
- Run 338 and Run 337 branches remain unchanged; this work is based on the exact Run 338 head.

## Validation

The existing Run 338 workflow is path-triggered by the receipt test file and therefore re-runs on this branch. It runs:

- receipt contract tests;
- SQLite receipt persistence tests;
- source coverage regression;
- strict TypeScript checks for the receipt adapters and HoidScreen import integration.

No passing result is claimed until GitHub Actions reports success on the Run 339 head.
