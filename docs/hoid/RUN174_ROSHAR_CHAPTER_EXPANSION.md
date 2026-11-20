# Run 174 — Roshar chapter 13/14 source expansion

## Scope

This run inspected three chapter bodies from the user's private Library EPUBs. It did not inspect or commit any EPUB container, XHTML body, extracted passage, image or private file path. The source files were materialized only into the temporary working environment for local inspection.

The current Library listing contained the Roshar omnibus and the standalone editions of Danzante del Filo and Esquirla del amanecer. A \`cosmere.epub\` file was not present in the listing used for this run, so no new Cosmere chapter was inspected.

## Source verification

All three EPUB ZIP containers passed CRC validation. For each target:

1. The edition's navigation-document SHA-256 matched the already registered edition digest.
2. The chapter was resolved from the navigation document.
3. The XHTML target matched exactly one OPF manifest item.
4. The item was present in the OPF spine.
5. The original XHTML bytes were fingerprinted independently.

| Work | Chapter | Edition ID | Relative XHTML target | Navigation SHA-256 | Document SHA-256 | Minimum open cursor |
|---|---:|---|---|---|---|---:|
| El Camino de los Reyes | 13 | roshar-omnibus-v1 | OEBPS/Text/L1-033.xhtml | 08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025 | 9716f41c822b8ea3801fd18d6072689d90482db419fd90d869fb12d8543da426 | 14 |
| Danzante del Filo | 14 | edgedancer-epub-v1 | OEBPS/Text/014.xhtml | 5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517 | 0c716a985a6f3ec2478788463d4b2ef132088829ce5d338101b0df9169edc17c | 15 |
| Esquirla del amanecer | 14 | dawnshard-epub-v1 | OEBPS/Text/14.xhtml | 8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075 | c62b4deedaa65671b41e69e944a5fb384f71cbfef4807d7d7ffd013b21225fb5 | 15 |

## Editorial staging

Three original Spanish summaries were added to \`src/hoid/editorialDrafts.ts\`:

- \`twok.chapter-013.dalinar-elkohar-abismoid-battle\`
- \`edgedancer.chapter-014.lift-investigation-red-storm\`
- \`dawnshard.chapter-014.rysns-treasure-warning\`

Each record is bound to the exact work, chapter, edition, navigation digest, XHTML digest, locator ID and summary digest. All three use the chapter itself as the completed-through evidence watermark; the minimum open reader cursor is N+1.

All three drafts remain \`pending-review\`. No claim, entity, relationship or summary was promoted to production. No activation receipt or reading-progress mutation was created.

## Updated inventory

| Measure | Current value |
|---|---:|
| Bibliography works | 24 |
| Verified navigation locators | 1,106 |
| Individually inspected chapter documents | 46 |
| Original staged summaries | 46 |
| Summaries pending independent review | 46 |
| Approved claims | 0 |
| Production knowledge entries | 0 |

The three new chapter documents advance the inspected ranges to chapters 1–13 for El Camino de los Reyes and 1–14 for each of Danzante del Filo and Esquirla del amanecer. El Imperio Final remains inspected through chapter 5.

## Next candidates

The metadata-only planner now points to:

| Work | Next chapter candidate |
|---|---:|
| El Imperio Final | 6 |
| El Camino de los Reyes | 14 |
| Danzante del Filo | 15 |
| Esquirla del amanecer | 15 |

The planner does not assert source availability. Each candidate still requires explicit local source selection and the same edition/manifest/spine checks before inspection.

## Security and copyright boundary

The repository contains only source metadata, relative locators, cryptographic digests and original editorial summaries. No copyrighted source text, EPUB bytes, XHTML, images or private file URIs were committed. The summaries remain unavailable to production responses until independent editorial review and the existing approval workflow complete.
