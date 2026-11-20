# Run 193 — Repair of chapter-nine regression fixtures

## Scope

Run 193 starts from the exact Run 192 head and does not modify Run 192, any earlier branch, or `main`.

Base commit: `ef7f6472ccecec51ffe926e27576210a64ccc4d4`.

## Findings from Run 192 CI

The Run 192 pull-request workflows exposed three stale test assumptions after El Imperio Final chapter 9 was added to the inspected-document allowlist:

1. `cosmereNavigationAudit.test.ts` still expected eight inspected TFE documents, although the authoritative allowlist correctly contained nine.
2. `editorialDrafts.test.ts` grouped every chapter-nine draft across all works and expected three. The new TFE chapter-nine draft made the correct total four; the original three are Roshar drafts.
3. `coreferenceResolver.test.ts` used TFE chapter 9 as its synthetic uninspected source. Chapter 9 is now inspected, so the fixture no longer represented an uninspected document and was correctly accepted.

These three stale assumptions caused failures in multiple workflows. The production evidence allowlist, source digest, and resolver behavior were not weakened or changed.

## Corrections

- The navigation audit now expects nine inspected TFE chapter documents.
- The editorial draft tests scope the three existing chapter-nine drafts to Roshar and separately assert that the TFE chapter-nine draft is present, edition-bound, correctly chapter-scoped, and still pending editorial review.
- Coreference negative fixtures now use TFE chapter 10, the next uninspected chapter. They assert the synthetic document digest remains the all-zero sentinel before testing that both resolution and registry audit reject it.

## Safety invariants preserved

- Chapter-nine TFE summary remains staging-only and pending review.
- The chapter-nine evidence watermark remains chapter 9; the earliest eligible open cursor remains chapter 10.
- Chapter 10 is not added to the inspected-document allowlist.
- No production claim, coreference registry record, activation receipt, or approved knowledge entry is added.
- No EPUB bytes, XHTML body, extracted source text, or private file path is committed.
- All progress and evidence unlocks remain work-specific.

## Validation

The Run 192 workflow logs showed only the stale assertions described above. Run 193 must still pass the full affected Vitest suites, TypeScript checks, and pull-request workflows before it can be considered validated.
