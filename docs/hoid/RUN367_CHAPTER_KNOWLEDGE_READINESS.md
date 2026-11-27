# Hoid IA — Run 367: chapter-level knowledge readiness

## Objective

Expose the editorial pipeline as independent, chapter-scoped stages after a local EPUB integrity audit. The projection is metadata-only and is not an authorization mechanism.

## Pipeline stages

For each reading-manifest unit, the projection distinguishes:

1. **Navigation identity** — an exact verified locator, an identity-only locator for ambiguous numbering, or an unverified/ambiguous unit.
2. **Body fingerprint registration** — whether a chapter XHTML digest exists in the sparse reviewed allowlist.
3. **Current local availability** — whether the selected EPUB session returned the exact registered digest during a completed audit.
4. **Editorial summary staging** — whether an original summary is still pending review and is bound to the exact work, edition, navigation digest, chapter locator and body digest.
5. **Production knowledge** — whether a production knowledge entry is bound to that exact chapter unit.
6. **Approved claim references** — how many approved claims cite knowledge entries whose explicit evidence source maps to that chapter unit.

These stages are deliberately non-interchangeable. In particular:
- a TOC locator does not prove that the chapter body was inspected;
- a registered digest does not prove that the current EPUB is available;
- a matching local digest does not prove editorial review;
- a staged summary is not approved knowledge;
- a production registry entry does not bypass the evidence runtime or spoiler-dependency gate.

## Audit binding

Run 367 adds `editionId`, `navigationSha256` and `manifestId` to completed and cancelled local audit results.

The readiness projection accepts a completed audit only when:
- the work, edition, navigation digest and manifest ID match the current manifest;
- the total and checked counts match the exact sparse digest allowlist;
- available and unavailable chapter arrays are dense, sorted, unique and disjoint;
- their union equals every registered digest chapter exactly once;
- the audit explicitly declares no source text returned, no source text persisted and no provider egress.

An invalid, cancelled or incomplete audit never contributes current-availability counts. Partial results are never projected.

## Editorial binding

A pending summary is counted only if its source chapter maps to one unambiguous reading unit and its locator, edition, navigation digest and body digest match the current manifest and allowlist.

Production knowledge is counted only when its explicit evidence source maps to one unambiguous unit and the exact locator. First-safe-appearance metadata alone is not treated as source evidence.

Invalid editorial bindings are counted as an integrity inconsistency; they are not silently reassigned to another chapter.

## Privacy and authority

The projection contains only:
- work and edition identifiers;
- chapter/unit numbers and internal unit IDs;
- stage labels and counts.

It excludes summary text, XHTML, locators, archive paths, file URIs and digests. The UI presents aggregate counts only.

The report always declares:
- `sourceTextIncluded: false`
- `providerEgress: "none"`
- `authorizationEffect: "none"`
- `progressEffect: "none"`
- `spoilerUnlockEffect: "none"`

The evidence runtime remains the sole narrative authorization gate. The projection cannot promote summaries, change reading progress, unlock spoilers or authorize answers.

## UI integration

After a completed local EPUB audit, `HoidEpubEditorialSourceAccessPanel` shows:
- verified navigation units and identity-only ambiguous units;
- registered body digests and currently available documents;
- pending-review summaries, production knowledge entries and approved-claim references.

The panel explicitly explains that local availability is not editorial approval or spoiler authorization. Its existing effect clears the audit view when the selected source port or work changes.

## Validation

- Chapter readiness projection tests.
- Existing local EPUB audit tests.
- Source coverage and display-projection regression tests.
- Strict TypeScript check for the new projection, tests, audit and panel.

All tests use synthetic source ports. They do not establish that private EPUBs are mounted in CI or inspect new narrative passages.
