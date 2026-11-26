# Hoid Run 340 — metadata-only source review handoff

## Objective

Turn the device-local chapter-inspection ledger into a visible, deterministic handoff list without treating a receipt as source access, editorial review, approval, or spoiler authorization.

## Contract

`projectHoidSourceInspectionReviewQueue()` accepts an untrusted ledger and first validates its exact schema, receipt fingerprints, catalogue identities, and edition-bound chapter manifests.

A valid receipt becomes a small queue item containing only:

- catalogue work ID and title;
- source group;
- edition ID;
- numeric chapter number;
- inspection timestamp;
- an explicit `awaiting-source-reselection` stage.

The projection deliberately marks:

- `sourceAvailability: "not-checked"`;
- `sourceReselectionRequired: true`;
- `reviewCanStart: false`;
- `reviewBlockReason: "receipt-does-not-contain-source-content"`;
- no summary, production write, editorial effect, or authorization effect.

The queue exposes no approve, reject, publish, or unlock action. Invalid or tampered ledgers are reported as unavailable; they are never replaced with an empty queue.

## UI integration

The EPUB import panel reads the same device-local SQLite receipt store and presents the handoff items separately from the static bibliography/source-coverage audit.

The list is a reminder that the original local EPUB must be selected again and the exact chapter reinspected before a human editorial review can begin. It does not retain a file URI, filename, archive path, EPUB/XHTML bytes, document digest, navigation locator, provider payload, conversation text, or summary prose.

## Safety boundaries

- Local receipts remain candidate-only.
- The handoff projection is metadata-only and has `authorizationEffect: "none"`.
- No summary is generated or approved.
- No production knowledge or approved claim is written.
- Reading progress is not changed.
- No chapter becomes newly eligible for a narrative answer.
- The trusted exact-unit answer host remains the only narrative authorization boundary.

## Validation

The dedicated workflow runs the handoff projection tests, receipt contract tests, SQLite persistence regression, and strict TypeScript checking of the handoff module, EPUB import panel, and HoidScreen integration.

No private EPUB bytes, XHTML, passages, source paths, or protected prose are committed.
