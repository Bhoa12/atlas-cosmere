# Roshar chapter-seven source ingestion

Run 120 extends the sparse, individually inspected chapter-document allowlist through chapter seven for the three Roshar EPUB editions currently accessible in the Library.

## Edition-bound source records

| Work ID | Edition ID | Navigation digest | Chapter locator | Chapter-document SHA-256 |
|---|---|---|---|---|
| `twok` | `roshar-omnibus-v1` | `08280d2afd0845699e5a9987d38c11c4f68626b372404700ac67ce604bf00025` | `L1-020.xhtml` | `30d9cecf9748261ad6e47fcea6064ac2f93ec523e8fe6a2d528d76306233bebb` |
| `edgedancer` | `edgedancer-epub-v1` | `5b98fb8090f55b3e9d597bd1317dad53bcd1b00e339196b7156aa2bd93ec1517` | `Text/007.xhtml` | `c98233f98e7b5368a1e9e1d6db216ebbc4c22b43aa056624758a76ff67d7540f` |
| `dawnshard` | `dawnshard-epub-v1` | `8ae9931de471b771c5d426556e6d8d3c05aed58565a24d504fcba7128bca8075` | `Text/7.xhtml` | `c2d2eb939495f883a1d507a42728ca3f39b561534e6984de56af574872066aaf` |

The navigation document digests were recomputed from the current EPUB bytes and match the already-registered edition digests. Each chapter href was checked against the edition navigation/NCX and spine before the body digest was calculated.

## Original editorial summaries

Three original Spanish summaries are staged:

- `twok.chapter-007.shallan-palanaeum-wait`
- `edgedancer.chapter-007.lift-tracks-darkness`
- `dawnshard.chapter-007.lopen-crew-unease`

Each summary is bound to its exact source locator, edition identity, navigation digest and chapter-document digest. Its own UTF-8 SHA-256 is recorded in `editorialDrafts.ts`.

All three require completion through chapter eight. Opening chapter eight is sufficient to show that chapter seven has been completed; opening chapter seven is not. All summaries remain pending independent editorial review and are excluded from production.

## Updated staging inventory

- 23 original summaries.
- 23 individually inspected chapter documents: chapters one through seven for the three Roshar works, plus two chapters of `El Imperio Final` inspected in an earlier run.
- 23 edition-bound source documents in the unified knowledge-bundle inventory.
- No approved summary, claim, identity or relationship is promoted by this ingestion.

## Copyright and availability

Only original summaries, metadata, relative locators and SHA-256 digests are stored in Git. No EPUB bytes, XHTML body, extracted passage, source image or text cache is committed.

The current Library listing exposes the three Roshar EPUBs but not `cosmere.epub`. No new Cosmere chapter body was inspected in this run.
