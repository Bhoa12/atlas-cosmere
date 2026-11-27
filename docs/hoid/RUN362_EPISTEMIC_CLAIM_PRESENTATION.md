# Run 362 — epistemic labels bound to approved claims

## Purpose

Run 361 connected accumulated investigation context to the conversation. Run 362 makes the epistemic status of each approved answer segment explicit so Hoid does not present an editorial interpretation as a source-backed assertion or a recommendation as a fact.

## Contract

- The existing atomic editorial draft already carries `assertionKind`; the review packet binds it through the draft claim digest.
- Exact-unit approved claims now preserve `assertionKind` as an optional, claim-hash-bound field.
- The exact-unit runtime copies only the approved claim's `intent` and `assertionKind` into its trusted answer segment.
- The UI projection reduces these fields to a small display classification. It does not expose internal claim IDs, evidence IDs, EPUB locators, source digests or unlock policies.
- The provider remains a selector of approved claim IDs. It cannot supply the claim text, epistemic category or visible label.

## Classification rules

| Metadata | Display class |
|---|---|
| `intent = recommend` | Reader recommendation |
| `assertionKind = interpretation` | Editorial interpretation |
| Any other recognized `assertionKind` | Evidence-backed editorial assertion |
| Missing `assertionKind` on a legacy claim | Unclassified |

“Evidence-backed editorial assertion” describes the editorial record and its bound evidence; it is not a guarantee of absolute truth. Legacy claims remain valid for compatibility but are never silently promoted to a factual label.

## Security and spoiler behavior

- The classification does not authorize content or change unlock thresholds.
- Exact-unit source integrity, chapter identity, first-safe-appearance, unlock policies, progress checks and spoiler-dependency closure remain authoritative.
- An unknown intent or assertion kind causes the display projection to reject the answer rather than invent a label.
- The assertion kind participates in the approved claim digest. Changing it after review invalidates the claim attestation.
- The display projection strips the internal assertion metadata after converting it to a fixed Spanish label.

## Privacy and source handling

This change contains no EPUB text, extracted passage, new narrative summary, private locator or source digest. Tests use synthetic claims and evidence. No private EPUB was inspected during this run; the existing bibliography remains metadata-only.

## Validation

The dedicated workflow runs epistemic-classification, exact-unit claim-integrity, exact-unit runtime, answer-display projection and spoiler-dependency regressions, followed by strict TypeScript checks including the Hoid screen.

## Rollout

The field is additive and optional so previously approved exact-unit claims remain verifiable. They display “TIPO DE AFIRMACIÓN SIN CLASIFICAR” until a reviewed claim record is reissued with an assertion kind. No production registry is modified and no automatic promotion or write is performed.
