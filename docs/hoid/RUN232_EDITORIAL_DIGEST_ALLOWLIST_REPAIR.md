# Run 232 — Editorial summary digest allowlist repair

## Base and isolation

- Repository: `Bhoa12/atlas-cosmere`
- Branch: `feat/hoid-ia-core-run232`
- Base branch: `feat/hoid-ia-core-run231`
- Base commit: `33a8873486b71ae3a404c3fb3f1fde203d54b294`
- This run does not modify `main`, PR #124, PR #123 or any earlier branch.

## Failure reproduced from Run 231

The Run 231 pull-request workflows exposed one shared assertion failure in `src/hoid/editorialDrafts.test.ts`:

`HOID_EDITORIAL_DRAFTS.map(draft => draft.summaryIntegrity.sha256)`

The runtime inventory contained 65 drafts, while the explicit expected digest array contained 63 entries. Because several assurance workflows execute this shared suite, the same assertion caused multiple workflow failures. The failures were not six independent implementation defects.

A comparison of the checked-in `editorialDrafts.ts` entries with the test allowlist identified exactly two missing digests:

| Draft ID | SHA-256 |
|---|---|
| `twok.chapter-019.dalinar-ancient-vision-and-radiants` | `7332568ccbb819b322df6b06d9ece8328707b5d6def9b5427a05c2e1d177a95f` |
| `edgedancer.chapter-020.lift-returns-to-azimir-and-aids-refugees` | `5aa4b4ea911c1e5ab0bca7dfebb7105dbf1a44b69fed63c3b47d80f81d459055` |

Both digests were already present in the corresponding source records and are verified against the UTF-8 summary text by the existing per-draft SHA-256 assertion. The test's explicit expected list had not been updated when those two Run 230 drafts were staged.

## Change

- Added the two missing SHA-256 values to the expected digest sequence in the exact order used by `HOID_EDITORIAL_DRAFTS`.
- Preserved the exact-length assertion of 65 drafts.
- Preserved the per-summary recomputation using `sha256Hex(draft.summary)`.
- Preserved the requirement that all 65 drafts remain `pending-review`.
- Preserved the empty production editorial registry assertion.

No summary text, source digest, chapter watermark, reading progress, evidence authorization, production claim or activation receipt was changed. No spoiler gate was weakened.

## Validation scope

The relevant Run 231 pull-request failures were all caused by this single shared digest-list mismatch:

- atomic claim validation;
- source ingestion plan;
- source coverage audit;
- canonical knowledge-kind contract;
- editorial review bundle;
- editorial draft validation.

Run 232 creates a new branch from the exact Run 231 head and leaves PR #124 untouched. Its own GitHub Actions results must complete before the repair is considered validated.

## Copyright and privacy

No EPUB, XHTML, extracted passage, private path, file URI or copyrighted source text is included. This change contains only two SHA-256 values already represented by original editorial summary records.
