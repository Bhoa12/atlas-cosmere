# Hoid editorial draft pipeline

## Purpose

The production evidence runtime may expose only original editorial claims that have passed an independent review. Source-derived notes are staged separately and are never imported by `editorialRegistry.ts`.

This run introduces the first source-backed draft from the accessible EPUB edition of **El camino de los reyes**. It is a draft, not approved production knowledge.

## Sources inspected

Three unique EPUB assets were available and inspected at chapter-one scope:

| Work | EPUB asset | Edition | Chapter locator | Chapter-document SHA-256 |
|---|---|---|---|---|
| `twok` — El camino de los reyes | `El_Archivo_de_las_Tormentas_15_Brandon_Sanderson.epub` | `roshar-omnibus-v1` | `OEBPS/Text/L1-012.xhtml` | `0853a9469afe233d415645208f04bafb7f5dd5d603af9706c8924bcf14d27a70` |
| `edgedancer` — Danzante del Filo | `4 Danzante del Filo Brandon Sanderson.epub` | `edgedancer-epub-v1` | `OEBPS/Text/001.xhtml` | `8a85e1ccb126c5915f3948351266030b0966abb822403ddd0415791c671ce7dc` |
| `dawnshard` — Esquirla del amanecer | `6 Esquirla del amanecer Brandon Sanderson.epub` | `dawnshard-epub-v1` | `OEBPS/Text/1.xhtml` | `eac1f947b3303414b0b8a69ff19eabcd396c1fdd32caa1c1349c931eb8d8d2ae` |

The navigation documents are EPUB 3 XHTML for the omnibus and NCX for the two standalone novellas. Their SHA-256 values match the edition manifests already stored in `verifiedChapterLocators.ts`. The three chapter-document hashes are independently allowlisted in `verifiedChapterDocuments.ts`:

- `roshar-omnibus-v1`: `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025`
- `edgedancer-epub-v1`: `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517`
- `dawnshard-epub-v1`: `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075`

Only metadata, relative locators and SHA-256 digests are committed. The EPUBs, chapter XHTML and source passages are not copied into the repository.

## First editorial batch

`src/hoid/editorialDrafts.ts` contains three original Spanish chapter-one summaries:

- `twok.chapter-001.cenn-battle` — the opening battle as seen by a young recruit;
- `edgedancer.chapter-001.lift-departure` — Lift's decision to leave the court and continue on her own path;
- `dawnshard.chapter-001.akinah-expedition` — Rysn's work, concern for Chiri-Chiri and the information that leads her to consider an expedition.

Each summary cites chapter 1 but unlocks at chapter 2. This matches the reader-boundary policy: while chapter 1 is open, chapter 1 is not yet considered completed.

The summaries are original editorial prose, not transcriptions or stored source excerpts. All three are marked `pending-review`.

## Review and promotion rules

A draft must pass all of the following before it can be considered for production:

1. Its bibliography work and first-appearance unit exist in the current edition manifest.
2. Its source locator matches the exact chapter unit in that edition.
3. Its navigation digest matches the edition manifest.
4. Its source-document digest exactly matches the sparse SHA-256 allowlist in `verifiedChapterDocuments.ts`, recorded by the offline ingestion step; a merely well-formed but unknown digest is rejected.
5. Its first appearance, source and unlock are all in the same work for draft schema v1; the first-appearance unit must have an exact locator, and the appearance cannot follow the unlock threshold. Cross-work chronology requires a future separately reviewed schema.
6. Its unlock threshold is a real unit in the same work and does not precede the source chapter.
7. Its summary is original editorial prose and contains no copied source passage.
8. An independent reviewer checks factual accuracy, completeness, originality and spoiler ceiling.
9. Only after review may a separate change add a knowledge entry and approved claim to `editorialRegistry.ts`.

The validator in `editorialDrafts.ts` deliberately accepts only `pending-review` records. It does not provide an API that promotes arbitrary runtime input into approved knowledge. Approval remains a separate source-controlled editorial action.

## Production isolation

- `HOID_EDITORIAL_DRAFTS` is staging-only.
- `editorialRegistry.ts` does not import the draft module.
- The production registry remains empty in this run.
- Hoid therefore continues to abstain when no approved claim exists.
- A provider cannot see or select a pending draft.

The tests assert that the pending summary is not returned by the production answer runtime and that the selector is not invoked.

## Current source coverage and limitations

The three unique Roshar EPUBs are available in the Library and their navigation metadata is recorded in `verifiedChapterLocators.ts`. This run inspected chapter 1 of the omnibus and both standalone novellas only; it does not claim coverage of later chapters or of all five main Roshar novels.

The private `cosmere.epub` was not present in the current Library listing. Its bibliography entries and previously recorded structural metadata remain catalogue information; no new passage-level claim is created for those works in this run.

The two standalone Roshar novellas were not re-inspected for narrative summaries in this run. No new summaries are claimed for them.

## Validation

Run:

```sh
npx vitest run src/hoid/editorialDrafts.test.ts src/hoid/verifiedChapterDocuments.test.ts src/hoid/editorialRegistry.test.ts src/hoid/evidenceScope.test.ts src/hoid/readingManifest.test.ts
```

The dedicated workflow also runs strict TypeScript checks over the draft validator and its provenance dependencies.

## Copyright boundary

Do not commit EPUBs, XHTML, copied paragraphs, chapter transcripts or extracted passage caches. Keep only bibliographic metadata, opaque navigation locators, cryptographic digests and original editorial summaries with explicit review status.
