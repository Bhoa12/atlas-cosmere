# Run 170 — verified Cosmere and Roshar chapter ingestion

## Scope

Run 170 inspected four exact chapter XHTML documents from the user's Library EPUBs:

- `cosmere.epub` — El Imperio Final, chapter 5;
- the Roshar omnibus — El Camino de los Reyes, chapter 12;
- the standalone Danzante del Filo EPUB — chapter 13;
- the standalone Esquirla del amanecer EPUB — chapter 13.

The four ZIP containers passed CRC validation. No source EPUB, XHTML body, extracted passage, image or private file path is included in this repository.

## Edition and document verification

For every work, the recorded navigation-document SHA-256 was rechecked against the selected Library copy. The target link was resolved relative to that navigation document, matched to exactly one OPF manifest item and confirmed in the OPF reading spine. The document SHA-256 below was computed over the exact original XHTML bytes.

| Work | Edition | Chapter | Navigation SHA-256 | Relative XHTML target | Document SHA-256 |
|---|---|---:|---|---|---|
| El Imperio Final | `cosmere-epub-merged-v1` | 5 | `85c53b4a8a24bffdd1c2cbba99bcd5da47d47b78589d784047e0fcb9cfab7aee` | `books/b000001/OEBPS/Text/005.xhtml` | `ec48d5ed29ede0760a63d913fcc71d79c908d879fe62841fe6cbfc64d90676d8` |
| El Camino de los Reyes | `roshar-omnibus-v1` | 12 | `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025` | `L1-032.xhtml` | `1f220d29b388c67834fb11d21fdb120407d1220531d735f946c00cc26223e838` |
| Danzante del Filo | `edgedancer-epub-v1` | 13 | `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517` | `Text/013.xhtml` | `341ffa8144efe7c054d92bbedd54246889a92b268db7b62118f6b651095a516d` |
| Esquirla del amanecer | `dawnshard-epub-v1` | 13 | `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075` | `Text/13.xhtml` | `e0a97fb4d28b90b99169e6afcdf4fbd3e42b67c1ff5b0c61e0cb4aad6405544c` |

## Original editorial staging

Four original Spanish summaries were added to `src/hoid/editorialDrafts.ts`:

- `tfe.chapter-005.kelsier-venture-atium`
- `twok.chapter-012.adolin-abismoid-hunt`
- `edgedancer.chapter-013.lift-emperor-decree`
- `dawnshard.chapter-013.lopen-akinah-landing`

Each draft has an independently checked UTF-8 summary SHA-256, a source-document digest, an edition-bound navigation locator, a first-safe-appearance coordinate and a pending-review status. No summary is approved or loaded into production knowledge.

## Cursor and evidence coordinate invariant

The source chapter is N. The evidence unlock watermark is the completed-through chapter N. The reader's open cursor must reach N+1 so that the cursor projection yields a completed-through position of N.

| Source chapter | Evidence watermark | Earliest open cursor |
|---:|---:|---:|
| 5 | 5 | 6 |
| 12 | 12 | 13 |
| 13 | 13 | 14 |
| 13 | 13 | 14 |

A new integration regression in `readingBoundary.test.ts` checks all four drafts through the real cursor projection and `isEvidenceUnlocked` boundary:

- the summary is blocked while the source chapter itself is open;
- it becomes eligible when the next chapter is open;
- progress in a different work cannot unlock it.

This test verifies only the authorization boundary. Pending editorial drafts remain unavailable to the production answer runtime.

## Updated inventory

- Bibliography: 24 works.
- Verified numbered-chapter locators: 1,106.
- Individually inspected chapter documents: 43.
- Original staged summaries: 43.
- Editorial review records: 61 (43 summaries, 1 atomic claim, 14 entity dossiers and 3 relationship drafts).
- Approved claims: 0.
- Production knowledge entries: 0.
- Activation receipt: `null`.

The ingestion planner now proposes chapters 6, 13, 14 and 14 for El Imperio Final, El Camino de los Reyes, Danzante del Filo and Esquirla del amanecer respectively. Candidate selection remains explicit and local; the planner itself does not inspect EPUBs or authorize evidence.
